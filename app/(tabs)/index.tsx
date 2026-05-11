import { useEffect, useState, useCallback } from 'react';
import { Alert, Linking, View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getDb } from '@/src/db/client';
import * as Books from '@/src/db/books';
import * as Highlights from '@/src/db/highlights';
import { search } from '@/src/db/search';
import type { Book, HighlightWithRelations } from '@/src/db/types';
import { EmptyState } from '@/src/components/EmptyState';
import { HighlightCard } from '@/src/components/HighlightCard';
import { CaptureTipsModal } from '@/src/components/CaptureTipsModal';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/theme/ThemeContext';
import { accentFor } from '@/src/theme/colors';
import { useAuthUser } from '@/src/auth/session';
import {
  FREE_EXTRACTION_LIMIT,
  getUsageCount,
  hasDismissedCaptureTips,
  isSubscribed,
  setCaptureTipsDismissed,
} from '@/src/db/meta';

export default function Library() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuthUser();
  const [permission, requestPermission] = ImagePicker.useCameraPermissions();
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [highlights, setHighlights] = useState<HighlightWithRelations[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [searchHighlights, setSearchHighlights] = useState<HighlightWithRelations[]>([]);
  const [searchBooks, setSearchBooks] = useState<Book[]>([]);
  // Default view is the user's highlight feed. They can flip to a books-grouped
  // view via the segmented control under the header.
  const [view, setView] = useState<'highlights' | 'books'>('highlights');
  // Free-tier usage. We hide the banner entirely for Pro users; `null` means
  // we haven't loaded yet and renders nothing to avoid a flash of the banner
  // on subscriber accounts.
  const [usage, setUsage] = useState<{ used: number; subscribed: boolean } | null>(null);
  // Tips modal is shown ahead of the camera on first capture. Showing it as
  // an in-screen modal (rather than a separate route) avoids a flicker between
  // route → modal → camera.
  const [tipsVisible, setTipsVisible] = useState(false);

  const load = useCallback(async () => {
    const db = await getDb();
    const [bs, hs, rows, used, subscribed] = await Promise.all([
      Books.listBooks(db),
      Highlights.listAllHighlights(db),
      db.getAllAsync<{ book_id: number; c: number }>(
        'SELECT book_id, COUNT(*) AS c FROM highlights WHERE deleted_at IS NULL GROUP BY book_id'
      ),
      getUsageCount(db),
      isSubscribed(db),
    ]);
    setBooks(bs);
    setHighlights(hs);
    setCounts(Object.fromEntries(rows.map((r) => [r.book_id, r.c])));
    setUsage({ used, subscribed });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!query.trim()) {
        setSearchHighlights([]);
        setSearchBooks([]);
        return;
      }
      const db = await getDb();
      const r = await search(db, query);
      if (cancelled) return;
      setSearchHighlights(r.highlights);
      setSearchBooks(r.books);
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Run the gate checks (permissions + free-tier quota) and then either open
  // the tips modal or jump straight to the camera. Centralising this here
  // means the /capture route only has to worry about extraction.
  const beginCapture = async () => {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        Alert.alert(
          'Camera access needed',
          'Enable camera access in system settings to capture highlights.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
    }

    const db = await getDb();
    const [used, subscribed] = await Promise.all([
      getUsageCount(db),
      isSubscribed(db),
    ]);
    if (!subscribed && used >= FREE_EXTRACTION_LIMIT) {
      router.push('/paywall');
      return;
    }

    if (await hasDismissedCaptureTips(db)) {
      await launchCamera();
    } else {
      setTipsVisible(true);
    }
  };

  const launchCamera = async () => {
    const picked = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.9,
      cameraType: ImagePicker.CameraType.back,
    });
    if (picked.canceled) return;
    const uri = picked.assets?.[0]?.uri;
    if (!uri) {
      Alert.alert('Capture failed', 'No photo was returned by the camera.');
      return;
    }
    router.push({ pathname: '/capture', params: { uri } });
  };

  const onTipsAcknowledge = async (dontShowAgain: boolean) => {
    setTipsVisible(false);
    if (dontShowAgain) {
      const db = await getDb();
      await setCaptureTipsDismissed(db);
    }
    await launchCamera();
  };

  const showingSearch = query.trim().length > 0;
  const firstName = (user?.displayName ?? '').split(' ')[0];
  const greeting = firstName ? `${firstName}'s highlights` : 'Your highlights';
  const totalHighlights = highlights.length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 }}>
            {/* Greeting + stats */}
            {!showingSearch && (
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: '700',
                    color: colors.text,
                    letterSpacing: -0.5,
                  }}
                >
                  {greeting}
                </Text>
                {usage && !usage.subscribed && (
                  <FreeUsageBanner
                    used={usage.used}
                    onUpgrade={() => router.push('/paywall')}
                  />
                )}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <StatPill
                    label="Books"
                    value={books.length}
                    icon="library"
                  />
                  <StatPill
                    label="Highlights"
                    value={totalHighlights}
                    icon="sparkles"
                  />
                </View>
              </View>
            )}

            {/* Search bar */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="search" size={18} color={colors.textSubtle} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search highlights and books"
                placeholderTextColor={colors.textSubtle}
                style={{
                  flex: 1,
                  padding: 12,
                  paddingLeft: 8,
                  color: colors.text,
                  fontSize: 15,
                }}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={12}>
                  <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
                </Pressable>
              )}
            </View>

            {!showingSearch && (
              <View
                style={{
                  flexDirection: 'row',
                  marginTop: 16,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 10,
                  padding: 4,
                }}
              >
                <SegmentButton
                  label="Highlights"
                  active={view === 'highlights'}
                  onPress={() => setView('highlights')}
                />
                <SegmentButton
                  label="Books"
                  active={view === 'books'}
                  onPress={() => setView('books')}
                />
              </View>
            )}
          </View>
        }
        data={
          showingSearch
            ? [
                ...searchBooks.map((b) => ({ kind: 'book' as const, book: b })),
                ...searchHighlights.map((h) => ({ kind: 'hl' as const, hl: h })),
              ]
            : view === 'books'
            ? books.map((b) => ({ kind: 'book' as const, book: b }))
            : highlights.map((h) => ({ kind: 'hl' as const, hl: h }))
        }
        keyExtractor={(item) =>
          item.kind === 'book' ? `b${item.book.id}` : `h${item.hl.id}`
        }
        ListEmptyComponent={
          showingSearch ? (
            <EmptyState message={`Nothing matches "${query}".`} />
          ) : view === 'books' ? (
            <EmptyState message="No books yet. Capture a highlight to add your first one." />
          ) : (
            <EmptyState message="No highlights yet. Tap the camera to capture your first one." />
          )
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) =>
          item.kind === 'book' ? (
            <BookCard
              book={item.book}
              count={counts[item.book.id] ?? 0}
              onPress={() => router.push(`/book/${item.book.id}`)}
            />
          ) : (
            <View style={{ paddingHorizontal: 20 }}>
              <HighlightCard
                highlight={item.hl}
                onPress={() => router.push(`/highlight/${item.hl.id}`)}
              />
            </View>
          )
        }
      />

      <CaptureTipsModal visible={tipsVisible} onAcknowledge={onTipsAcknowledge} />

      {/* FAB */}
      <Pressable
        onPress={beginCapture}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 24,
          bottom: 32,
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 8,
          shadowColor: colors.primary,
          shadowOpacity: 0.4,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <Ionicons name="camera" color={colors.primaryText} size={28} />
      </Pressable>
    </SafeAreaView>
  );
}

function FreeUsageBanner({
  used,
  onUpgrade,
}: {
  used: number;
  onUpgrade: () => void;
}) {
  const { colors } = useTheme();
  // Clamp so the bar visually fills (and the text reads sensibly) even if the
  // counter somehow slipped past the limit before the paywall gate kicked in.
  const capped = Math.min(used, FREE_EXTRACTION_LIMIT);
  const remaining = Math.max(0, FREE_EXTRACTION_LIMIT - used);
  const ratio = capped / FREE_EXTRACTION_LIMIT;
  // Shift the bar from primary → danger as the user approaches the cap so the
  // urgency is visible at a glance.
  const barColor = remaining === 0 ? colors.danger : remaining <= 2 ? colors.accent : colors.primary;

  return (
    <Pressable
      onPress={onUpgrade}
      style={({ pressed }) => ({
        marginTop: 14,
        padding: 14,
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: barColor + '22',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="flash" size={16} color={barColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
            {used}/{FREE_EXTRACTION_LIMIT} free highlights used
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            {remaining === 0
              ? 'Upgrade to keep capturing'
              : `${remaining} left — tap to go Pro`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </View>
      {/* Progress bar */}
      <View
        style={{
          marginTop: 12,
          height: 6,
          borderRadius: 999,
          backgroundColor: colors.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${ratio * 100}%`,
            height: '100%',
            backgroundColor: barColor,
            borderRadius: 999,
          }}
        />
      </View>
    </Pressable>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: active ? colors.surface : 'transparent',
        // Subtle elevation on the active pill so it reads as a raised tab.
        elevation: active ? 1 : 0,
        shadowColor: active ? '#000' : 'transparent',
        shadowOpacity: active ? 0.08 : 0,
        shadowRadius: active ? 4 : 0,
        shadowOffset: { width: 0, height: 1 },
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: active ? colors.text : colors.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={14} color={colors.textMuted} />
        <Text
          style={{
            fontSize: 12,
            color: colors.textMuted,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 24,
          fontWeight: '700',
          color: colors.text,
          marginTop: 4,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function BookCard({
  book,
  count,
  onPress,
}: {
  book: Book;
  count: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const accent = accentFor(book.title, colors.accentPalette);
  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 6 }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderRadius: 14,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {/* Accent stripe */}
        <View style={{ width: 6, backgroundColor: accent }} />
        <View style={{ flex: 1, padding: 16 }}>
          <Text
            style={{ fontWeight: '600', fontSize: 16, color: colors.text }}
            numberOfLines={2}
          >
            {book.title}
          </Text>
          {book.author && (
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
              {book.author}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}>
            <View
              style={{
                backgroundColor: colors.surfaceAlt,
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                {count} highlight{count === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ justifyContent: 'center', paddingRight: 14 }}>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </View>
      </Pressable>
    </View>
  );
}
