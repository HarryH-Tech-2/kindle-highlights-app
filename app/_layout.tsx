import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { initDb } from '@/src/db/init';
import { getDb } from '@/src/db/client';
import { hasSeenOnboarding, isSubscribed } from '@/src/db/meta';
import {
  configureGoogleSignIn,
  getCurrentUser,
  onAuthStateChanged,
  type AuthUser,
} from '@/src/auth/firebase';
import { runSync } from '@/src/sync/sync';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

function RootLayoutInner() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      return getCurrentUser();
    } catch {
      return null;
    }
  });
  const [seenOnboarding, setSeenOnboarding] = useState(false);
  // Tracks whether the user was just on the login wall. Lets us push them into
  // the library after sign-in instead of stranding them on /account.
  const wasSignedOutRef = useRef<boolean>(!user);

  // One-time bootstrap: init the DB, then learn whether the user has finished
  // onboarding so we know where to send them.
  useEffect(() => {
    (async () => {
      try {
        await initDb();
        const db = await getDb();
        const seen = await hasSeenOnboarding(db);
        setSeenOnboarding(seen);
        setReady(true);
      } catch (e) {
        setError(e as Error);
      }
    })();
  }, []);

  // Auth subscription + auto-sync on sign-in for Pro users. We keep `user` in
  // state here (rather than only inside screens) so the routing effect below
  // can react to sign-in/out without re-mounting the whole tree.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      configureGoogleSignIn();
      unsub = onAuthStateChanged(async (u) => {
        setUser(u);
        if (!u) return;
        try {
          const db = await getDb();
          if (!(await isSubscribed(db))) return;
          await runSync(db, u.uid);
        } catch {
          // Silent — sync failures shouldn't block the app or alert the user.
        }
      });
    } catch {
      // Native auth module missing in this dev build — fine, treat as signed-out.
    }
    return () => unsub?.();
  }, []);

  // Routing rules, evaluated whenever the relevant state changes:
  //   1. Haven't finished onboarding → /onboarding
  //   2. Onboarded but signed out → /account (login wall)
  //   3. Just signed in (was on login wall) → / (into the library)
  //   4. Onboarded and signed in → leave them wherever they are
  // We defer the redirect with setTimeout(0) so the Stack has a chance to mount
  // before we navigate; otherwise expo-router throws "navigation was not
  // handled" on cold launch.
  useEffect(() => {
    if (!ready) return;
    if (!seenOnboarding) {
      const id = setTimeout(() => router.replace('/onboarding'), 0);
      return () => clearTimeout(id);
    }
    if (!user) {
      wasSignedOutRef.current = true;
      const id = setTimeout(() => router.replace('/account'), 0);
      return () => clearTimeout(id);
    }
    if (wasSignedOutRef.current) {
      wasSignedOutRef.current = false;
      const id = setTimeout(() => router.replace('/'), 0);
      return () => clearTimeout(id);
    }
  }, [ready, seenOnboarding, user, router]);

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: colors.bg,
        }}
      >
        <Text style={{ color: colors.text }}>Failed to initialize database</Text>
        <Text selectable style={{ color: colors.textMuted }}>{error.message}</Text>
      </View>
    );
  }
  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        contentStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="capture" options={{ title: 'Capture' }} />
      <Stack.Screen name="review" options={{ title: 'Review' }} />
      <Stack.Screen name="book/[id]" options={{ title: 'Book' }} />
      <Stack.Screen name="highlight/[id]" options={{ title: 'Highlight' }} />
      <Stack.Screen name="tag/[name]" options={{ title: 'Tag' }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="paywall" options={{ title: 'Upgrade' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy & terms' }} />
      <Stack.Screen
        name="account"
        options={{
          // When signed out, /account acts as a login wall — hide the header so
          // there's no back button and the design is full-bleed.
          headerShown: user !== null,
          title: 'Account & Sync',
        }}
      />
    </Stack>
  );
}
