// Lightweight pub/sub for "sync just finished". Screens that mounted before
// the initial post-sign-in sync completed (e.g. the Library landing screen
// after a fresh sign-in) subscribe here and re-fetch from SQLite when the
// event fires — without this, runSync silently pulls rows from Firestore
// into the local DB but the already-rendered list stays empty until the
// next focus/refresh.
//
// Deliberately tiny and synchronous: no event payload, no error handling
// beyond logging — listeners must be idempotent and cheap.

type Listener = () => void;

const listeners = new Set<Listener>();

export function onSyncCompleted(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitSyncCompleted(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch (e) {
      console.warn('[sync] listener threw', e);
    }
  }
}
