import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ScrollView,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from '@/src/db/client';
import * as Books from '@/src/db/books';
import * as Highlights from '@/src/db/highlights';
import * as Meta from '@/src/db/meta';
import { wipeUserScopedData } from '@/src/db/meta';
import { renderLibrary } from '@/src/export/markdown';
import { shareMarkdown } from '@/src/export/share';
import { useTheme } from '@/src/theme/ThemeContext';
import { type ThemeMode } from '@/src/theme/colors';
import { signOut, deleteCurrentUser } from '@/src/auth/firebase';
import { useAuthUser } from '@/src/auth/session';
import { runSync } from '@/src/sync/sync';
import { deleteAllUserData } from '@/src/sync/firestore';

export default function Settings() {
  const router = useRouter();
  const { colors, mode, setMode } = useTheme();
  const { user } = useAuthUser();
  const [busy, setBusy] = useState<null | 'export' | 'signout' | 'sync' | 'delete'>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!user) {
      setLastSyncedAt(null);
      setSubscribed(false);
      return;
    }
    (async () => {
      try {
        const db = await getDb();
        setLastSyncedAt((await Meta.getLastSyncedAt(db)) || null);
        setSubscribed(await Meta.isSubscribed(db));
      } catch {
        // ignore
      }
    })();
  }, [user]);

  const handleSync = async () => {
    if (busy || !user) return;
    setBusy('sync');
    try {
      const db = await getDb();
      const result = await runSync(db, user.uid);
      setLastSyncedAt((await Meta.getLastSyncedAt(db)) || null);
      Alert.alert('Sync complete', `Pushed ${result.pushed} • Pulled ${result.pulled}`);
    } catch (e: any) {
      Alert.alert('Sync failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const exportAll = async () => {
    if (busy) return;
    // Export is a Pro-only feature. Non-subscribers tapping the row are
    // routed to the paywall rather than seeing a flat "not subscribed"
    // alert — matches the pattern used by the capture flow at the
    // free-tier limit.
    if (!subscribed) {
      router.push('/paywall');
      return;
    }
    setBusy('export');
    try {
      const db = await getDb();
      const books = await Books.listBooks(db);
      const sections = await Promise.all(
        books.map(async (book) => ({
          book,
          highlights: await Highlights.listHighlightsByBook(db, book.id),
        }))
      );
      const md = renderLibrary(sections.filter((s) => s.highlights.length > 0));
      if (!md.trim()) {
        Alert.alert('Nothing to export', 'You have no highlights yet.');
        return;
      }
      await shareMarkdown('all-highlights', md);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setBusy('signout');
          try {
            await signOut();
            // Wipe the previous account's data so the next sign-in (even
            // mid-session) starts clean and pulls only its own highlights.
            const db = await getDb();
            await wipeUserScopedData(db);
          } catch (e: any) {
            Alert.alert('Sign-out failed', e?.message ?? 'Unknown error');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  // Two-step destructive flow required by Play's account-deletion policy.
  // Order matters: Firestore docs first (we need the user's auth token to
  // satisfy security rules), then the Auth user, then local SQLite. If the
  // auth credential has aged out, Firebase throws auth/requires-recent-login
  // — we surface that with a clear "sign out and back in" message because
  // re-prompting for Google credentials mid-flow would be jarring.
  const handleDeleteAccount = () => {
    if (!user) return;
    Alert.alert(
      'Delete your account?',
      'This permanently removes your books, highlights, tags, and notes from the cloud and from this device, and deletes your sign-in record. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            // Second confirmation so a single fat-fingered tap doesn't nuke
            // someone's library.
            Alert.alert(
              'Are you absolutely sure?',
              'Your highlights, books, tags, and account will be deleted. There is no undo.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete everything',
                  style: 'destructive',
                  onPress: async () => {
                    setBusy('delete');
                    try {
                      await deleteAllUserData(user.uid);
                      await deleteCurrentUser();
                      const db = await getDb();
                      await wipeUserScopedData(db);
                      // No success Alert — the /login redirect (driven by
                      // _layout's auth listener) is its own confirmation.
                    } catch (e: any) {
                      if (e?.code === 'auth/requires-recent-login') {
                        Alert.alert(
                          'Please sign in again',
                          'For your security, account deletion needs a fresh sign-in. Sign out, sign back in, then try again.'
                        );
                      } else {
                        Alert.alert('Delete failed', e?.message ?? 'Unknown error');
                      }
                    } finally {
                      setBusy(null);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20, gap: 28, paddingBottom: 60 }}
    >
      {/* Profile card */}
      {user && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 14,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: '700', fontSize: 18 }}>
              {(user.displayName ?? user.email ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
              {user.displayName ?? 'Signed in'}
            </Text>
            {user.email ? (
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                {user.email}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Appearance */}
      <Section title="Appearance">
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surfaceAlt,
            borderRadius: 12,
            padding: 4,
            gap: 4,
          }}
        >
          {(['light', 'dark'] as ThemeMode[]).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 9,
                  backgroundColor: active ? colors.surface : 'transparent',
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                  shadowColor: active ? '#000' : 'transparent',
                  shadowOpacity: active ? 0.05 : 0,
                  shadowRadius: 3,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: active ? 1 : 0,
                }}
              >
                <Ionicons
                  name={m === 'light' ? 'sunny' : 'moon'}
                  size={14}
                  color={active ? colors.text : colors.textMuted}
                />
                <Text
                  style={{
                    color: active ? colors.text : colors.textMuted,
                    fontWeight: '600',
                    fontSize: 14,
                    textTransform: 'capitalize',
                  }}
                >
                  {m}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {/* Data */}
      <Section title="Your library">
        {user && (
          <Row
            icon="sync"
            label="Sync now"
            hint={
              lastSyncedAt
                ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
                : 'Push and pull changes from your account'
            }
            onPress={handleSync}
            busy={busy === 'sync'}
          />
        )}
        <Row
          icon="download-outline"
          label="Export all highlights"
          hint={subscribed ? 'Save as Markdown' : 'Pro — save as Markdown'}
          onPress={exportAll}
          busy={busy === 'export'}
          locked={!subscribed}
        />
      </Section>

      {/* About — extra bottom margin so the rounded card visually
          separates from the destructive Sign out / Delete actions below
          and doesn't feel crammed against them. */}
      <View style={{ marginBottom: 12 }}>
        <Section title="About">
          <Row
            icon="star-outline"
            label="Rate the app"
            hint="Help others discover it"
            onPress={() => {
              const url = 'market://details?id=com.harry.highlightcapture';
              Linking.openURL(url).catch(() => {
                Linking.openURL(
                  'https://play.google.com/store/apps/details?id=com.harry.highlightcapture'
                );
              });
            }}
          />
          <Row
            icon="document-text-outline"
            label="Privacy & terms"
            onPress={() => router.push('/privacy')}
          />
        </Section>
      </View>

      {/* Developer tools — only present in dev builds. __DEV__ is stripped
          (and the whole branch tree-shaken) in production bundles. */}
      {__DEV__ && (
        <Section title="Developer">
          <Row
            icon="bug-outline"
            label="Show onboarding flow"
            hint="Replay the onboarding screens"
            onPress={() => router.push('/onboarding')}
          />
          <Row
            icon="star-outline"
            label="Show review prompt"
            hint="Trigger the in-app rating dialog"
            onPress={async () => {
              try {
                const available = await StoreReview.isAvailableAsync();
                if (!available) {
                  Alert.alert(
                    'Review prompt unavailable',
                    'StoreReview.isAvailableAsync() returned false on this device/build.'
                  );
                  return;
                }
                await StoreReview.requestReview();
              } catch (e: any) {
                Alert.alert('Review prompt failed', e?.message ?? 'Unknown error');
              }
            }}
          />
        </Section>
      )}

      {/* Sign-out */}
      {user && (
        <Pressable
          onPress={handleSignOut}
          disabled={busy !== null}
          style={({ pressed }) => ({
            borderRadius: 14,
            paddingVertical: 14,
            borderWidth: 1,
            borderColor: colors.danger,
            alignItems: 'center',
            opacity: busy === 'signout' ? 0.6 : pressed ? 0.7 : 1,
          })}
        >
          {busy === 'signout' ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '600' }}>
              Sign out
            </Text>
          )}
        </Pressable>
      )}

      {/* Delete account — kept visually distinct from sign-out (filled
          danger background vs outline) so the irreversible action reads
          as more serious than the reversible one. */}
      {user && (
        <Pressable
          onPress={handleDeleteAccount}
          disabled={busy !== null}
          style={({ pressed }) => ({
            borderRadius: 14,
            paddingVertical: 14,
            backgroundColor: colors.danger,
            alignItems: 'center',
            opacity: busy === 'delete' ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          {busy === 'delete' ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={{ color: colors.primaryText, fontSize: 15, fontWeight: '600' }}>
              Delete account
            </Text>
          )}
        </Pressable>
      )}

      <Text style={{ color: colors.textSubtle, fontSize: 12, textAlign: 'center' }}>
        Lumio v{Constants.expoConfig?.version ?? '0.0.0'}
      </Text>
    </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          paddingHorizontal: 4,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  hint,
  onPress,
  busy,
  danger,
  locked,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint?: string;
  onPress: () => void;
  busy?: boolean;
  danger?: boolean;
  locked?: boolean;
}) {
  const { colors } = useTheme();
  const labelColor = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        // First child has no top border — RN doesn't expose :first-child, so
        // we clip it via the parent's `overflow: hidden` + tweak below.
        marginTop: -1,
        gap: 12,
        opacity: busy ? 0.6 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: labelColor, fontSize: 15, fontWeight: '500' }}>{label}</Text>
        {hint && (
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{hint}</Text>
        )}
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : locked ? (
        <Ionicons name="lock-closed" size={14} color={colors.textSubtle} />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
      )}
    </Pressable>
  );
}
