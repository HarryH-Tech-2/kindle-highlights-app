// React hook around src/auth/firebase.ts. Subscribes to Firebase's
// onAuthStateChanged so any screen can render based on the current user
// without each screen managing its own subscription.

import { useEffect, useState } from 'react';
import { onAuthStateChanged, getCurrentUser, type AuthUser } from './firebase';

export type AuthState = {
  user: AuthUser | null;
  loading: boolean;
};

export function useAuthUser(): AuthState {
  // Seed with whatever Firebase already has cached so the first paint isn't
  // forced through a "loading" state on warm starts.
  const [state, setState] = useState<AuthState>(() => {
    try {
      const u = getCurrentUser();
      return { user: u, loading: u === null };
    } catch {
      // Native module missing in this dev build — treat as signed-out.
      return { user: null, loading: false };
    }
  });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = onAuthStateChanged((u) => setState({ user: u, loading: false }));
    } catch {
      setState({ user: null, loading: false });
    }
    return () => {
      unsub?.();
    };
  }, []);

  return state;
}
