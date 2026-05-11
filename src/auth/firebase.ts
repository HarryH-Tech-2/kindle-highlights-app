// Lazy wrappers around @react-native-firebase/auth and the Google Sign-In
// SDK. Mirrors the lazy-require pattern in src/billing.ts so the JS bundle
// keeps loading on dev clients that haven't yet been rebuilt with these
// native modules.
//
// Usage flow (Google):
//   1. Call configureGoogleSignIn() once at app startup with your Firebase
//      project's Web client ID.
//   2. signInWithGoogle() opens the system Google account picker, exchanges
//      the resulting ID token for a Firebase credential, and signs the user
//      in to Firebase Auth. Returns the firebase.auth.User on success or
//      null if the user cancelled.
//   3. signOut() clears both the Google session and the Firebase session.

// Replace this in Firebase Console (Authentication → Sign-in method → Google
// → "Web SDK configuration"). Keeping it as a constant rather than env var
// because it's a public client ID, not a secret.
export const GOOGLE_WEB_CLIENT_ID =
  '203266428663-9b84u9os48klro3193jumiq1gjsek897.apps.googleusercontent.com';

type AuthDefaultExport = typeof import('@react-native-firebase/auth').default;
type AuthInstance = ReturnType<AuthDefaultExport>;
type AuthModule = typeof import('@react-native-firebase/auth').default & {
  // GoogleAuthProvider is a static on the default export
  GoogleAuthProvider: { credential: (idToken: string) => unknown };
};
type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

let cachedAuth: AuthInstance | null = null;
let cachedAuthModule: AuthModule | null = null;
let cachedGoogle: GoogleSignInModule | null = null;
let googleConfigured = false;

function loadAuthModule(): AuthModule {
  if (cachedAuthModule) return cachedAuthModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/auth') as { default: AuthModule };
    cachedAuthModule = mod.default;
    return cachedAuthModule;
  } catch {
    throw new Error(
      'Firebase Auth requires a dev build with @react-native-firebase/auth installed.'
    );
  }
}

function loadAuth(): AuthInstance {
  if (cachedAuth) return cachedAuth;
  const authMod = loadAuthModule();
  cachedAuth = authMod();
  return cachedAuth;
}

function loadGoogle(): GoogleSignInModule {
  if (cachedGoogle) return cachedGoogle;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedGoogle = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
    return cachedGoogle;
  } catch {
    throw new Error(
      'Google Sign-In requires a dev build with @react-native-google-signin/google-signin installed.'
    );
  }
}

// Test seam: lets unit tests inject fakes without installing native modules.
export function _setAuthForTests(opts: {
  authModule?: AuthModule | null;
  authInstance?: AuthInstance | null;
  google?: GoogleSignInModule | null;
  googleConfigured?: boolean;
}): void {
  if ('authModule' in opts) cachedAuthModule = opts.authModule ?? null;
  if ('authInstance' in opts) cachedAuth = opts.authInstance ?? null;
  if ('google' in opts) cachedGoogle = opts.google ?? null;
  if (typeof opts.googleConfigured === 'boolean') googleConfigured = opts.googleConfigured;
}

export function configureGoogleSignIn(): void {
  if (googleConfigured) return;
  const g = loadGoogle();
  g.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  googleConfigured = true;
}

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export type FirebaseUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

function toAuthUser(u: FirebaseUser | null): AuthUser | null {
  if (!u) return null;
  return { uid: u.uid, email: u.email, displayName: u.displayName };
}

// Returns null if the user cancelled the picker; throws on real errors.
export async function signInWithGoogle(): Promise<AuthUser | null> {
  configureGoogleSignIn();
  const g = loadGoogle();
  try {
    await g.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = (await g.GoogleSignin.signIn()) as unknown as {
      idToken?: string | null;
      data?: { idToken?: string | null };
    };
    // v13 returns { type, data: { idToken, user } }; older returned { idToken } directly.
    const idToken = result?.data?.idToken ?? result?.idToken ?? null;
    if (!idToken) return null;
    const authMod = loadAuthModule();
    const credential = authMod.GoogleAuthProvider.credential(idToken);
    const userCred = (await loadAuth().signInWithCredential(
      credential as Parameters<AuthInstance['signInWithCredential']>[0]
    )) as unknown as { user: FirebaseUser };
    return toAuthUser(userCred.user);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    // Google Sign-In status codes — surfaced as strings on Android.
    if (code === 'SIGN_IN_CANCELLED' || code === '12501' || code === 'CANCELED') {
      return null;
    }
    throw e;
  }
}

export async function signOut(): Promise<void> {
  const auth = loadAuth();
  // Best-effort Google revocation; firebase signOut is the source of truth.
  // Newer Google Sign-In SDKs no longer expose isSignedIn(); calling signOut()
  // when already signed out is a no-op, so we just attempt it.
  try {
    const g = loadGoogle();
    await g.GoogleSignin.signOut();
  } catch {
    // Ignore — user may have signed in via another provider, or Google
    // module may be missing in dev builds.
  }
  await auth.signOut();
}

export function getCurrentUser(): AuthUser | null {
  const u = loadAuth().currentUser as FirebaseUser | null;
  return toAuthUser(u);
}

export function onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void {
  const auth = loadAuth();
  return auth.onAuthStateChanged((u) => cb(toAuthUser(u as FirebaseUser | null)));
}
