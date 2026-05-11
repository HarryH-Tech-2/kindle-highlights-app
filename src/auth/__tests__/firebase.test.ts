import {
  _setAuthForTests,
  signInWithGoogle,
  signOut,
  getCurrentUser,
  onAuthStateChanged,
} from '../firebase';

type FakeUser = { uid: string; email: string | null; displayName: string | null };

function makeFakes(initialUser: FakeUser | null = null) {
  let currentUser: FakeUser | null = initialUser;
  const listeners: ((u: FakeUser | null) => void)[] = [];

  const auth = {
    get currentUser() {
      return currentUser;
    },
    signInWithCredential: jest.fn(async (_cred: unknown) => {
      currentUser = { uid: 'u1', email: 'a@b.com', displayName: 'A' };
      listeners.forEach((l) => l(currentUser));
      return { user: currentUser };
    }),
    signOut: jest.fn(async () => {
      currentUser = null;
      listeners.forEach((l) => l(null));
    }),
    onAuthStateChanged: (cb: (u: FakeUser | null) => void) => {
      listeners.push(cb);
      cb(currentUser);
      return () => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };

  const authModule = Object.assign(jest.fn(() => auth), {
    GoogleAuthProvider: { credential: (idToken: string) => ({ idToken }) },
  });

  const google: {
    GoogleSignin: {
      configure: jest.Mock;
      hasPlayServices: jest.Mock;
      signIn: jest.Mock;
      signOut: jest.Mock;
    };
    statusCodes: Record<string, unknown>;
  } = {
    GoogleSignin: {
      configure: jest.fn(),
      hasPlayServices: jest.fn(async () => true),
      signIn: jest.fn(async () => ({ data: { idToken: 'tok-1' } })),
      signOut: jest.fn(async () => undefined),
    },
    statusCodes: {},
  };

  return { auth, authModule, google };
}

describe('signInWithGoogle', () => {
  test('exchanges Google ID token for a Firebase credential and returns the user', async () => {
    const { authModule, auth, google } = makeFakes();
    _setAuthForTests({
      authModule: authModule as unknown as Parameters<typeof _setAuthForTests>[0]['authModule'],
      authInstance: auth as unknown as Parameters<typeof _setAuthForTests>[0]['authInstance'],
      google: google as unknown as Parameters<typeof _setAuthForTests>[0]['google'],
      googleConfigured: true,
    });
    const u = await signInWithGoogle();
    expect(u?.uid).toBe('u1');
    expect(auth.signInWithCredential).toHaveBeenCalledTimes(1);
  });

  test('returns null if user cancels the Google picker', async () => {
    const { authModule, auth, google } = makeFakes();
    google.GoogleSignin.signIn = jest.fn(async () => {
      throw Object.assign(new Error('cancelled'), { code: 'SIGN_IN_CANCELLED' });
    });
    _setAuthForTests({
      authModule: authModule as unknown as Parameters<typeof _setAuthForTests>[0]['authModule'],
      authInstance: auth as unknown as Parameters<typeof _setAuthForTests>[0]['authInstance'],
      google: google as unknown as Parameters<typeof _setAuthForTests>[0]['google'],
      googleConfigured: true,
    });
    const u = await signInWithGoogle();
    expect(u).toBeNull();
  });

  test('returns null when Google returns no ID token (defensive)', async () => {
    const { authModule, auth, google } = makeFakes();
    google.GoogleSignin.signIn = jest.fn(async () => ({ data: { idToken: null } }));
    _setAuthForTests({
      authModule: authModule as unknown as Parameters<typeof _setAuthForTests>[0]['authModule'],
      authInstance: auth as unknown as Parameters<typeof _setAuthForTests>[0]['authInstance'],
      google: google as unknown as Parameters<typeof _setAuthForTests>[0]['google'],
      googleConfigured: true,
    });
    const u = await signInWithGoogle();
    expect(u).toBeNull();
    expect(auth.signInWithCredential).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  test('clears Google session and calls Firebase signOut', async () => {
    const { authModule, auth, google } = makeFakes({
      uid: 'u1',
      email: null,
      displayName: null,
    });
    _setAuthForTests({
      authModule: authModule as unknown as Parameters<typeof _setAuthForTests>[0]['authModule'],
      authInstance: auth as unknown as Parameters<typeof _setAuthForTests>[0]['authInstance'],
      google: google as unknown as Parameters<typeof _setAuthForTests>[0]['google'],
      googleConfigured: true,
    });
    await signOut();
    expect(google.GoogleSignin.signOut).toHaveBeenCalled();
    expect(auth.signOut).toHaveBeenCalled();
  });
});

describe('getCurrentUser / onAuthStateChanged', () => {
  test('returns the current user', async () => {
    const { authModule, auth, google } = makeFakes({
      uid: 'u1',
      email: null,
      displayName: null,
    });
    _setAuthForTests({
      authModule: authModule as unknown as Parameters<typeof _setAuthForTests>[0]['authModule'],
      authInstance: auth as unknown as Parameters<typeof _setAuthForTests>[0]['authInstance'],
      google: google as unknown as Parameters<typeof _setAuthForTests>[0]['google'],
      googleConfigured: true,
    });
    expect(getCurrentUser()?.uid).toBe('u1');
  });

  test('onAuthStateChanged emits on sign-in/out', async () => {
    const { authModule, auth, google } = makeFakes();
    _setAuthForTests({
      authModule: authModule as unknown as Parameters<typeof _setAuthForTests>[0]['authModule'],
      authInstance: auth as unknown as Parameters<typeof _setAuthForTests>[0]['authInstance'],
      google: google as unknown as Parameters<typeof _setAuthForTests>[0]['google'],
      googleConfigured: true,
    });
    const seen: (string | null)[] = [];
    const unsub = onAuthStateChanged((u) => seen.push(u?.uid ?? null));
    await signInWithGoogle();
    await signOut();
    unsub();
    // Initial null + signed in + signed out
    expect(seen[0]).toBeNull();
    expect(seen).toContain('u1');
    expect(seen[seen.length - 1]).toBeNull();
  });
});

afterEach(() => {
  _setAuthForTests({
    authModule: null,
    authInstance: null,
    google: null,
    googleConfigured: false,
  });
});
