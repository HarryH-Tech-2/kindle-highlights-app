import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ScrollView,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from '@/src/db/client';
import * as Books from '@/src/db/books';
import * as Highlights from '@/src/db/highlights';
import { renderLibrary } from '@/src/export/markdown';
import { shareMarkdown } from '@/src/export/share';
import { useTheme } from '@/src/theme/ThemeContext';
import { type ThemeMode } from '@/src/theme/colors';
import { signOut } from '@/src/auth/firebase';
import { useAuthUser } from '@/src/auth/session';

const FEEDBACK_EMAIL = 'feedback@kindlehighlights.app';

export default function Settings() {
  const router = useRouter();
  const { colors, mode, setMode } = useTheme();
  const { user } = useAuthUser();
  const [busy, setBusy] = useState<null | 'export' | 'clear' | 'signout'>(null);

  const exportAll = async () => {
    if (busy) return;
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

  const handleClearData = () => {
    Alert.alert(
      'Clear local data?',
      'This deletes every book, highlight, and tag stored on this device. ' +
        'Anything backed up to your account stays safe and will re-sync on next login.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setBusy('clear');
            try {
              const db = await getDb();
              await db.execAsync('DELETE FROM highlight_tags;');
              await db.execAsync('DELETE FROM highlights;');
              await db.execAsync('DELETE FROM tags;');
              await db.execAsync('DELETE FROM books;');
              Alert.alert('Cleared', 'All local highlights have been removed.');
            } catch (e: any) {
              Alert.alert('Clear failed', e?.message ?? 'Unknown error');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
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
          } catch (e: any) {
            Alert.alert('Sign-out failed', e?.message ?? 'Unknown error');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const handleFeedback = async () => {
    const url = `mailto:${FEEDBACK_EMAIL}?subject=Kindle%20Highlights%20feedback`;
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert('No email app found', `Send feedback to ${FEEDBACK_EMAIL}`);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20, gap: 28, paddingBottom: 60 }}
    >
      {/* Profile chip */}
      {user && (
        <Pressable
          onPress={() => router.push('/account' as never)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 14,
            opacity: pressed ? 0.85 : 1,
          })}
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
              {user.displayName ?? 'Account'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
              {user.email ?? 'Manage account & sync'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </Pressable>
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
          {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => {
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
                  name={m === 'light' ? 'sunny' : m === 'dark' ? 'moon' : 'phone-portrait'}
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
        <Row
          icon="download-outline"
          label="Export all highlights"
          hint="Save as Markdown"
          onPress={exportAll}
          busy={busy === 'export'}
        />
        <Row
          icon="trash-outline"
          label="Clear local data"
          hint="Delete books, highlights, and tags on this device"
          onPress={handleClearData}
          busy={busy === 'clear'}
          danger
        />
      </Section>

      {/* About */}
      <Section title="About">
        <Row
          icon="mail-outline"
          label="Send feedback"
          hint="Tell us what you'd love to see"
          onPress={handleFeedback}
        />
        <Row
          icon="star-outline"
          label="Rate the app"
          hint="Help others discover it"
          onPress={() => {
            const url = 'market://details?id=com.harry.kindlehighlights';
            Linking.openURL(url).catch(() => {
              Linking.openURL(
                'https://play.google.com/store/apps/details?id=com.harry.kindlehighlights'
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

      <Text style={{ color: colors.textSubtle, fontSize: 12, textAlign: 'center' }}>
        Kindle Highlights v{Constants.expoConfig?.version ?? '0.0.0'}
      </Text>
    </ScrollView>
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
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint?: string;
  onPress: () => void;
  busy?: boolean;
  danger?: boolean;
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
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
      )}
    </Pressable>
  );
}
