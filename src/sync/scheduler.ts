// Debounced background sync trigger.
//
// Call `scheduleSync()` after any user-visible mutation (create / update /
// delete a highlight, book, or tag). All calls within a short window
// coalesce into a single `runSync(db, uid)` execution, so a flurry of edits
// — typing in a note, toggling tags — produces exactly one network round
// trip a beat after the user stops.
//
// Errors are swallowed with a console.warn so that a transient sync failure
// (offline, Firestore rules tightening) never interrupts the foreground
// user flow. The Account screen's "Sync now" button surfaces sync errors
// to the user via Alert when they manually retry.

import { getCurrentUser } from '@/src/auth/firebase';
import { getDb } from '@/src/db/client';
import { runSync } from './sync';

// 800ms balances "feels instant" against "doesn't fire on every keystroke".
// A user typing a note will pause naturally between sentences, batching the
// updates into one push.
const DEBOUNCE_MS = 800;

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;

export function scheduleSync(): void {
  // Skip silently when signed out — there's nothing to sync to.
  let uid: string | null = null;
  try {
    uid = getCurrentUser()?.uid ?? null;
  } catch {
    // Native auth module missing (dev build before EAS rebuild). Treat as
    // signed out — local-only mode.
    return;
  }
  if (!uid) return;
  // Capture in a const so the timer closure sees a non-null uid — `let uid`
  // declared above doesn't narrow across the closure boundary.
  const capturedUid = uid;

  // Reset the debounce window on each call so the timer only fires once the
  // user has been quiet for DEBOUNCE_MS.
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    void runScheduled(capturedUid);
  }, DEBOUNCE_MS);
}

async function runScheduled(uid: string): Promise<void> {
  // If a previous sync is still running, chain after it rather than running
  // two `runSync` calls concurrently — runSync isn't designed to be
  // re-entrant on the same DB connection.
  if (inFlight) {
    try {
      await inFlight;
    } catch {
      // Don't let a previous failure cancel this one.
    }
  }
  inFlight = (async () => {
    try {
      const db = await getDb();
      await runSync(db, uid);
    } catch (e) {
      console.warn('[sync] scheduled sync failed', e);
    }
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

// Test seam: flush any pending debounced sync immediately and wait for it
// to settle. Lets unit tests assert post-mutation sync behavior without
// real timers.
export async function _flushScheduledSyncForTests(): Promise<void> {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  if (inFlight) {
    try {
      await inFlight;
    } catch {
      // ignore
    }
  }
}
