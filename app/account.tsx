import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useAuthUser } from '@/src/auth/session';
import { signInWithGoogle, signOut } from '@/src/auth/firebase';
import { runSync } from '@/src/sync/sync';
import { getDb } from '@/src/db/client';
import * as Meta from '@/src/db/meta';
import { useTheme } from '@/src/theme/ThemeContext';

export default function AccountScreen() {
  const { user, loading } = useAuthUser();
  const { colors } = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState<null | 'signin' | 'signout' | 'sync'>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const db = await getDb();
        setLastSyncedAt((await Meta.getLastSyncedAt(db)) || null);
      } catch {
        // ignore
      }
    })();
  }, [user]);

  const handleSignIn = async () => {
    if (busy) return;
    setBusy('signin');
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      Alert.alert('Sign-in failed', (e as Error)?.message ?? 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const handleSignOut = async () => {
    if (busy) return;
    setBusy('signout');
    try {
      await signOut();
    } catch (e: unknown) {
      Alert.alert('Sign-out failed', (e as Error)?.message ?? 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async () => {
    if (busy || !user) return;
    setBusy('sync');
    try {
      const db = await getDb();
      if (!(await Meta.isSubscribed(db))) {
        Alert.alert(
          'Pro required',
          'Cross-device sync is part of Kindle Highlights Pro. Subscribe from the upgrade screen.'
        );
        return;
      }
      const result = await runSync(db, user.uid);
      setLastSyncedAt((await Meta.getLastSyncedAt(db)) || null);
      Alert.alert('Sync complete', `Pushed ${result.pushed} • Pulled ${result.pulled}`);
    } catch (e: unknown) {
      Alert.alert('Sync failed', (e as Error)?.message ?? 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
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

  // ─── Signed-out: full-screen login wall ───────────────────────────────────
  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, paddingHorizontal: 32, justifyContent: 'center' }}>
          {/* Hero mark */}
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 28,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                shadowColor: colors.primary,
                shadowOpacity: 0.3,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 12 },
                elevation: 8,
              }}
            >
              <Ionicons name="book" size={48} color={colors.primaryText} />
            </View>
            <Text
              style={{
                fontSize: 30,
                fontWeight: '700',
                color: colors.text,
                textAlign: 'center',
                letterSpacing: -0.5,
              }}
            >
              Kindle Highlights
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: colors.textMuted,
                textAlign: 'center',
                marginTop: 8,
                lineHeight: 22,
              }}
            >
              Capture, organise, and revisit every passage you care about.
            </Text>
          </View>

          {/* Primary CTA */}
          <Pressable
            onPress={handleSignIn}
            disabled={busy !== null}
            style={({ pressed }) => ({
              backgroundColor: colors.text,
              borderRadius: 14,
              paddingVertical: 16,
              paddingHorizontal: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.6 : pressed ? 0.9 : 1,
              gap: 12,
            })}
          >
            {busy === 'signin' ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={colors.bg} />
                <Text style={{ color: colors.bg, fontSize: 16, fontWeight: '600' }}>
                  Continue with Google
                </Text>
              </>
            )}
          </Pressable>

          <Text
            style={{
              fontSize: 12,
              color: colors.textSubtle,
              textAlign: 'center',
              marginTop: 24,
              lineHeight: 18,
            }}
          >
            By continuing you agree to our{' '}
            <Text
              onPress={() => router.push('/privacy')}
              style={{ color: colors.primary, fontWeight: '600' }}
            >
              Terms & Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Signed-in: account dashboard ─────────────────────────────────────────
  const initial = (user.displayName ?? user.email ?? '?').trim().charAt(0).toUpperCase();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20, gap: 20 }}
    >
      {/* Identity card */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.primaryText, fontSize: 22, fontWeight: '700' }}>
            {initial}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
            {user.displayName ?? 'Signed in'}
          </Text>
          {user.email ? (
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>
              {user.email}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Sync */}
      <Pressable
        onPress={handleSync}
        disabled={busy !== null}
        style={({ pressed }) => ({
          backgroundColor: colors.primary,
          borderRadius: 14,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: busy ? 0.6 : pressed ? 0.9 : 1,
        })}
      >
        {busy === 'sync' ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <>
            <Ionicons name="sync" size={18} color={colors.primaryText} />
            <Text style={{ color: colors.primaryText, fontSize: 16, fontWeight: '600' }}>
              Sync now
            </Text>
          </>
        )}
      </Pressable>

      {lastSyncedAt ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
          Last synced {new Date(lastSyncedAt).toLocaleString()}
        </Text>
      ) : null}

      {/* Sign out */}
      <Pressable
        onPress={handleSignOut}
        disabled={busy !== null}
        style={({ pressed }) => ({
          borderRadius: 14,
          paddingVertical: 16,
          borderWidth: 1,
          borderColor: colors.danger,
          alignItems: 'center',
          opacity: busy ? 0.6 : pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ color: colors.danger, fontSize: 16, fontWeight: '600' }}>
          {busy === 'signout' ? 'Signing out…' : 'Sign out'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
