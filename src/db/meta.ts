import type { DbExec } from './client';

// The `meta` table is a generic key-value store created in the initial migration.
// We use it for app-level flags (onboarding seen, free-tier usage count, etc.)
// so we don't need a new schema version every time we add one of these.

export async function getMeta(db: DbExec, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    [key]
  );
  return row ? row.value : null;
}

export async function setMeta(db: DbExec, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    [key, value]
  );
}

const ONBOARDING_KEY = 'onboarding_seen';
const USAGE_COUNT_KEY = 'usage_count';
const SUBSCRIBED_KEY = 'subscribed';
const SKIP_CAPTURE_TIPS_KEY = 'skip_capture_tips';

export const FREE_EXTRACTION_LIMIT = 10;

export async function hasSeenOnboarding(db: DbExec): Promise<boolean> {
  return (await getMeta(db, ONBOARDING_KEY)) === 'true';
}

export async function markOnboardingSeen(db: DbExec): Promise<void> {
  await setMeta(db, ONBOARDING_KEY, 'true');
}

export async function getUsageCount(db: DbExec): Promise<number> {
  const v = await getMeta(db, USAGE_COUNT_KEY);
  const n = v ? parseInt(v, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function incrementUsageCount(db: DbExec): Promise<number> {
  const n = (await getUsageCount(db)) + 1;
  await setMeta(db, USAGE_COUNT_KEY, String(n));
  return n;
}

export async function isSubscribed(db: DbExec): Promise<boolean> {
  return (await getMeta(db, SUBSCRIBED_KEY)) === 'true';
}

export async function hasDismissedCaptureTips(db: DbExec): Promise<boolean> {
  return (await getMeta(db, SKIP_CAPTURE_TIPS_KEY)) === 'true';
}

export async function setCaptureTipsDismissed(db: DbExec): Promise<void> {
  await setMeta(db, SKIP_CAPTURE_TIPS_KEY, 'true');
}

export async function setSubscribed(db: DbExec, subscribed: boolean): Promise<void> {
  await setMeta(db, SUBSCRIBED_KEY, subscribed ? 'true' : 'false');
}

// Sync cursor + identity. last_synced_at is the high-water mark of remote
// updated_at values we've successfully merged in; it's also reused as the
// "dirty since" cursor for the next push. current_user_id lets us detect
// account switches and reset the cursor so we don't leak rows across users.
const LAST_SYNCED_AT_KEY = 'last_synced_at';
const CURRENT_USER_ID_KEY = 'current_user_id';

export async function getLastSyncedAt(db: DbExec): Promise<number> {
  const v = await getMeta(db, LAST_SYNCED_AT_KEY);
  const n = v ? parseInt(v, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function setLastSyncedAt(db: DbExec, ms: number): Promise<void> {
  await setMeta(db, LAST_SYNCED_AT_KEY, String(ms));
}

export async function getCurrentUserId(db: DbExec): Promise<string | null> {
  return getMeta(db, CURRENT_USER_ID_KEY);
}

export async function setCurrentUserId(db: DbExec, uid: string | null): Promise<void> {
  if (uid === null) {
    await db.runAsync('DELETE FROM meta WHERE key = ?', [CURRENT_USER_ID_KEY]);
  } else {
    await setMeta(db, CURRENT_USER_ID_KEY, uid);
  }
}

export async function resetSyncCursor(db: DbExec): Promise<void> {
  await db.runAsync('DELETE FROM meta WHERE key = ?', [LAST_SYNCED_AT_KEY]);
}
