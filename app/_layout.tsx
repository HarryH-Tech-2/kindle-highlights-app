import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import {
  useFonts,
  SpaceGrotesk_300Light,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { Lora_400Regular, Lora_400Regular_Italic } from '@expo-google-fonts/lora';
import { PlayfairDisplay_400Regular } from '@expo-google-fonts/playfair-display';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { SourceCodePro_400Regular } from '@expo-google-fonts/source-code-pro';
import { initDb } from '@/src/db/init';
import { getDb } from '@/src/db/client';
import { hasSeenOnboarding } from '@/src/db/meta';
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
  const pathname = usePathname();
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
  // Load Space Grotesk + Inter up front. The app blocks on `ready`
  // already for the DB bootstrap; we tie font loading into the same gate so
  // text never flashes from the system fallback to the loaded family.
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Lora_400Regular,
    Lora_400Regular_Italic,
    PlayfairDisplay_400Regular,
    JetBrainsMono_400Regular,
    SourceCodePro_400Regular,
  });
  // Tracks whether the user was just on the login wall. Lets us push them into
  // the library after sign-in instead of stranding them on /login.
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

  // Auth subscription + auto-sync on sign-in for all signed-in users. Tier is
  // stamped on each pushed doc inside runSync, so free and pro can co-exist
  // in Firestore. We keep `user` in state here (rather than only inside
  // screens) so the routing effect below can react to sign-in/out without
  // re-mounting the whole tree.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      configureGoogleSignIn();
      unsub = onAuthStateChanged(async (u) => {
        setUser(u);
        try {
          // Auth may rehydrate before the bootstrap effect's initDb() resolves
          // on cold launch. Await initDb here (memoised) so reads below never
          // hit an un-migrated DB ("no such table: meta").
          await initDb();
          const db = await getDb();
          // Re-read the onboarding flag whenever auth changes. The user may
          // have just finished onboarding immediately before signing in, and
          // our local state copy of `seenOnboarding` would otherwise be stale
          // — leading to a "sign in twice" bounce back through /onboarding.
          const seen = await hasSeenOnboarding(db);
          setSeenOnboarding(seen);
          if (u) await runSync(db, u.uid);
        } catch (e) {
          // Background sync failures shouldn't alert the user, but they
          // should be visible in dev logs — silent failures here are the
          // exact thing that makes "my highlights aren't syncing" bugs
          // impossible to triage. The Account screen's Sync Now button
          // surfaces the same error via Alert when the user invokes it.
          console.warn('[sync] background sync failed', e);
        }
      });
    } catch {
      // Native auth module missing in this dev build — fine, treat as signed-out.
    }
    return () => unsub?.();
  }, []);

  // Routing rules, evaluated whenever the relevant state changes:
  //   1. Signed in + just came from the login wall → / (into the library)
  //   2. Signed in (already in the app) → leave them where they are
  //   3. Signed out + never onboarded → /onboarding
  //   4. Signed out + onboarded → /login
  // Auth is checked BEFORE onboarding so a signed-in user is never bounced
  // back through onboarding because of a stale local flag — the old order
  // caused "sign in twice" because finishing onboarding wrote the flag to
  // SQLite but didn't refresh _layout's `seenOnboarding` state.
  // We defer the redirect with setTimeout(0) so the Stack has a chance to
  // mount before we navigate; otherwise expo-router throws "navigation was
  // not handled" on cold launch.
  useEffect(() => {
    if (!ready) return;
    if (user) {
      if (wasSignedOutRef.current) {
        wasSignedOutRef.current = false;
        const id = setTimeout(() => router.replace('/'), 0);
        return () => clearTimeout(id);
      }
      return;
    }
    if (!seenOnboarding) {
      const id = setTimeout(() => router.replace('/onboarding'), 0);
      return () => clearTimeout(id);
    }
    wasSignedOutRef.current = true;
    // /forgot-password is a legitimate signed-out destination — the user
    // reached it intentionally from /login to recover their password.
    // Bouncing them back to /login here would make the feature unusable.
    if (pathname === '/forgot-password' || pathname === '/privacy') return;
    const id = setTimeout(() => router.replace('/login'), 0);
    return () => clearTimeout(id);
  }, [ready, seenOnboarding, user, router, pathname]);

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
  if (!ready || !fontsLoaded) {
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
      <Stack.Screen
        name="book/[id]"
        options={{
          title: 'Book',
          // Books "open" upward into view — feels like flipping a cover open
          // rather than the default horizontal push.
          animation: 'slide_from_bottom',
          animationDuration: 320,
        }}
      />
      <Stack.Screen name="highlight/[id]" options={{ title: 'Highlight' }} />
      <Stack.Screen name="beautify/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="tag/[name]" options={{ title: 'Tag' }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="paywall" options={{ title: 'Upgrade' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy & terms' }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
    </Stack>
  );
}
