import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Linking,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
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
import { accentFor, fonts } from '@/src/theme/colors';
import {
  FREE_EXTRACTION_LIMIT,
  getUsageCount,
  hasDismissedCaptureTips,
  isSubscribed,
  setCaptureTipsDismissed,
} from '@/src/db/meta';
import { onSyncCompleted } from '@/src/sync/events';

export default function Library() {
  const router = useRouter();
  const { colors } = useTheme();
  const [permission, requestPermission] = ImagePicker.useCameraPermissions();
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [highlights, setHighlights] = useState<HighlightWithRelations[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [searchHighlights, setSearchHighlights] = useState<HighlightWithRelations[]>([]);
  const [searchBooks, setSearchBooks] = useState<Book[]>([]);
  // Free-tier usage. We hide the banner entirely for Pro users; `null` means
  // we haven't loaded yet and renders nothing to avoid a flash of the banner
  // on subscriber accounts.
  const [usage, setUsage] = useState<{ used: number; subscribed: boolean } | null>(null);
  // Bumping this re-rolls the hero highlight pick.
  const [shuffleNonce, setShuffleNonce] = useState(0);
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

  useEffect(() => onSyncCompleted(() => { void load(); }), [load]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!query.trim()) {
        setSearchHighlights([]);
        setSearchBooks([]);
        return;
      }
      const db = await getDb();
      const r = await search(db, query);
      if (canceled) return;
      setSearchHighlights(r.highlights);
      setSearchBooks(r.books);
    })();
    return () => {
      canceled = true;
    };
  }, [query]);

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
      router.push('/capture');
    } else {
      setTipsVisible(true);
    }
  };

  const onTipsAcknowledge = async (dontShowAgain: boolean) => {
    setTipsVisible(false);
    if (dontShowAgain) {
      const db = await getDb();
      await setCaptureTipsDismissed(db);
    }
    router.push('/capture');
  };

  const showingSearch = query.trim().length > 0;
  const totalHighlights = highlights.length;

  // Pick one highlight at random for the hero, biased toward older ones
  // the user might have forgotten. Re-rolls when shuffleNonce changes.
  const heroHighlight = useMemo<HighlightWithRelations | null>(() => {
    if (highlights.length === 0) return null;
    // Bias: 70% chance to draw from the older half of the list, so the hero
    // surfaces stuff that's fallen off the recency feed.
    const drawOld = highlights.length > 4 && Math.random() < 0.7;
    const slice = drawOld
      ? highlights.slice(Math.floor(highlights.length / 2))
      : highlights;
    return slice[Math.floor(Math.random() * slice.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights, shuffleNonce]);

  // Editorial-style stats line — replaces the two stat pills.
  const statsLine = useMemo(() => {
    if (totalHighlights === 0) return 'No highlights yet';
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const thisMonth = highlights.filter((h) => h.created_at >= monthStart).length;
    const bookCount = books.length;
    const parts = [
      `${totalHighlights} highlight${totalHighlights === 1 ? '' : 's'}`,
      `${bookCount} book${bookCount === 1 ? '' : 's'}`,
    ];
    if (thisMonth > 0) parts.push(`${thisMonth} this month`);
    return parts.join(' \u00b7 ');
  }, [highlights, books, totalHighlights]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
            {!showingSearch && (
              <View style={{ marginBottom: 16 }}>
                {/* Editorial header — serif, low-key. */}
                <Text
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 34,
                    lineHeight: 40,
                    color: colors.text,
                    letterSpacing: -0.5,
                  }}
                >
                  Your Highlights
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 13,
                    color: colors.textMuted,
                    marginTop: 6,
                  }}
                >
                  {statsLine}
                </Text>
                {usage && !usage.subscribed && (
                  <FreeUsageBanner
                    used={usage.used}
                    onUpgrade={() => router.push('/paywall')}
                  />
                )}
              </View>
            )}

            {/* Shelf — sits above search so the user always sees their books
                first, before deciding to search or scroll the feed. */}
            {!showingSearch && books.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <BookShelf
                  books={books}
                  counts={counts}
                  onOpen={(b) => router.push(`/book/${b.id}`)}
                />
              </View>
            )}

            {/* Search — sits in surfaceAlt rather than a bordered box. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surfaceAlt,
                borderRadius: 12,
                paddingHorizontal: 12,
              }}
            >
              <Ionicons name="search" size={17} color={colors.textMuted} />
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
                  fontFamily: fonts.sans,
                }}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={12}>
                  <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
                </Pressable>
              )}
            </View>

            {/* Hero highlight sits below search — random pick to rediscover. */}
            {!showingSearch && heroHighlight && (
              <HeroHighlight
                highlight={heroHighlight}
                onShuffle={() => setShuffleNonce((n) => n + 1)}
                onOpen={() => router.push(`/highlight/${heroHighlight.id}`)}
                onBeautify={() => router.push(`/beautify/${heroHighlight.id}`)}
              />
            )}

            {!showingSearch && (
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: colors.textSubtle,
                  marginTop: 26,
                  marginBottom: 4,
                }}
              >
                All highlights
              </Text>
            )}
          </View>
        }
        data={
          showingSearch
            ? [
                ...searchBooks.map((b) => ({ kind: 'book' as const, book: b })),
                ...searchHighlights.map((h) => ({ kind: 'hl' as const, hl: h })),
              ]
            : highlights.map((h) => ({ kind: 'hl' as const, hl: h }))
        }
        keyExtractor={(item) =>
          item.kind === 'book' ? `b${item.book.id}` : `h${item.hl.id}`
        }
        ListEmptyComponent={
          showingSearch ? (
            <EmptyState
              icon="search"
              title="Nothing yet"
              message={`No highlights or books match \u201C${query}\u201D.`}
            />
          ) : (
            <EmptyState
              icon="bookmark-outline"
              title="An empty page"
              message="Tap Capture below to add your first highlight from a Kindle screenshot."
            />
          )
        }
        contentContainerStyle={{ paddingBottom: 140 }}
        renderItem={({ item }) =>
          item.kind === 'book' ? (
            <SearchBookRow
              book={item.book}
              count={counts[item.book.id] ?? 0}
              onPress={() => router.push(`/book/${item.book.id}`)}
            />
          ) : (
            <View style={{ paddingHorizontal: 20 }}>
              <HighlightCard
                highlight={item.hl}
                showSource
                onPress={() => router.push(`/highlight/${item.hl.id}`)}
              />
            </View>
          )
        }
      />

      <CaptureTipsModal visible={tipsVisible} onAcknowledge={onTipsAcknowledge} />

      {/* Capture pill — explicit, inviting, sits like a button rather than
          a mystery FAB. Floats above the tab bar. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 24,
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={beginCapture}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 22,
            paddingVertical: 14,
            borderRadius: 999,
            backgroundColor: colors.primary,
            ...Platform.select({
              ios: {
                shadowColor: colors.primary,
                shadowOpacity: 0.35,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
              },
              android: { elevation: 8 },
            }),
            transform: [{ scale: pressed ? 0.96 : 1 }],
          })}
        >
          <Ionicons name="camera" color={colors.primaryText} size={20} />
          <Text
            style={{
              color: colors.primaryText,
              fontFamily: fonts.sans,
              fontSize: 15,
              fontWeight: '700',
              letterSpacing: 0.3,
            }}
          >
            Capture highlight
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// Big quote card at the top of the home feed. Picks one of the user's
// highlights at random and gives them a way to keep shuffling. The
// design intent is "rediscover something you forgot you saved".
function HeroHighlight({
  highlight,
  onShuffle,
  onOpen,
  onBeautify,
}: {
  highlight: HighlightWithRelations;
  onShuffle: () => void;
  onOpen: () => void;
  onBeautify: () => void;
}) {
  const { colors } = useTheme();
  const accent = accentFor(highlight.book.title, colors.accentPalette);
  const styleColor = highlight.styleParsed?.color ?? colors.text;
  return (
    <View style={{ marginTop: 22 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: colors.textSubtle,
          }}
        >
          Rediscover
        </Text>
        <Pressable
          onPress={onShuffle}
          hitSlop={10}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Ionicons name="shuffle" size={14} color={colors.textMuted} />
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 12,
              color: colors.textMuted,
              fontWeight: '600',
            }}
          >
            Shuffle
          </Text>
        </Pressable>
      </View>
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderRadius: 20,
          overflow: 'hidden',
          ...Platform.select({
            ios: {
              shadowColor: colors.shadow,
              shadowOpacity: 0.08,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
            },
            android: { elevation: 3 },
          }),
          opacity: pressed ? 0.96 : 1,
        })}
      >
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 24,
            bottom: 24,
            width: 3,
            backgroundColor: accent,
            borderTopRightRadius: 3,
            borderBottomRightRadius: 3,
          }}
        />
        <View style={{ padding: 24, paddingLeft: 26 }}>
          <Text
            numberOfLines={6}
            style={{
              fontFamily: fonts.serif,
              fontSize: 20,
              lineHeight: 30,
              color: styleColor,
              fontStyle: highlight.styleParsed?.italic ? 'italic' : 'normal',
            }}
          >
            {highlight.text}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 14,
              gap: 8,
            }}
          >
            <View
              style={{
                width: 18,
                height: 1,
                backgroundColor: accent,
              }}
            />
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 12,
                color: colors.textMuted,
                fontWeight: '600',
                letterSpacing: 0.3,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {highlight.book.title}
              {highlight.book.author ? `, ${highlight.book.author}` : ''}
            </Text>
            {/* Beautify shortcut — stopPropagation so tapping doesn't also
                fire the hero card's onOpen. */}
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onBeautify();
              }}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: colors.primary + '15',
                borderWidth: 1,
                borderColor: colors.primary + '33',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="sparkles" size={12} color={colors.primary} />
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: fonts.sans,
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                Beautify
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

// Horizontal shelf of book "spines" — each spine is a tall narrow rect
// in the book's accent color with the title set vertically. Echoes a
// physical shelf of books and uses the data we already have.
function BookShelf({
  books,
  counts,
  onOpen,
}: {
  books: Book[];
  counts: Record<number, number>;
  onOpen: (b: Book) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 26 }}>
      <Text
        style={{
          fontFamily: fonts.sans,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          color: colors.textSubtle,
          marginBottom: 10,
        }}
      >
        Shelf
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 8, alignItems: 'flex-end' }}
      >
        {books.map((b) => {
          const accent = accentFor(b.title, colors.accentPalette);
          const count = counts[b.id] ?? 0;
          // Slight height variation so spines look like real books — same
          // hash-seed so a given book is always the same height.
          let heightSeed = 0;
          for (let i = 0; i < b.title.length; i++) {
            heightSeed = (heightSeed * 31 + b.title.charCodeAt(i)) | 0;
          }
          const height = 130 + (Math.abs(heightSeed) % 28);
          return (
            <Pressable
              key={b.id}
              onPress={() => onOpen(b)}
              style={({ pressed }) => ({
                width: 38,
                height,
                borderRadius: 4,
                backgroundColor: accent,
                paddingVertical: 10,
                paddingHorizontal: 4,
                alignItems: 'center',
                justifyContent: 'space-between',
                ...Platform.select({
                  ios: {
                    shadowColor: colors.shadow,
                    shadowOpacity: 0.18,
                    shadowRadius: 4,
                    shadowOffset: { width: 1, height: 2 },
                  },
                  android: { elevation: 1 },
                }),
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {/* Top inset line — book cover detail */}
              <View
                style={{
                  height: 1,
                  width: 22,
                  backgroundColor: 'rgba(255,255,255,0.35)',
                }}
              />
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#fbf6ec',
                  // Rotate the title 90° so it reads up the spine.
                  transform: [{ rotate: '-90deg' }],
                  width: height - 40,
                  textAlign: 'center',
                  letterSpacing: 0.3,
                }}
              >
                {b.title}
              </Text>
              {/* Bottom highlight count chip */}
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  backgroundColor: 'rgba(0,0,0,0.22)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 10,
                    fontWeight: '700',
                    color: '#fbf6ec',
                  }}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
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
  const capped = Math.min(used, FREE_EXTRACTION_LIMIT);
  const remaining = Math.max(0, FREE_EXTRACTION_LIMIT - used);
  const ratio = capped / FREE_EXTRACTION_LIMIT;
  const barColor = remaining === 0 ? colors.danger : remaining <= 2 ? colors.accent : colors.primary;

  return (
    <Pressable
      onPress={onUpgrade}
      style={({ pressed }) => ({
        marginTop: 16,
        padding: 14,
        backgroundColor: colors.surface,
        borderRadius: 14,
        opacity: pressed ? 0.92 : 1,
        ...Platform.select({
          ios: {
            shadowColor: colors.shadow,
            shadowOpacity: 0.05,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 },
          },
          android: { elevation: 1 },
        }),
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: barColor + '22',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="flash" size={15} color={barColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 14,
              fontWeight: '600',
              color: colors.text,
            }}
          >
            {used}/{FREE_EXTRACTION_LIMIT} free highlights used
          </Text>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 12,
              color: colors.textMuted,
              marginTop: 2,
            }}
          >
            {remaining === 0
              ? 'Upgrade to keep capturing'
              : `${remaining} left \u00b7 tap to go Pro`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
      </View>
      <View
        style={{
          marginTop: 12,
          height: 4,
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

// Search-result row for a book. Distinct from the shelf spines so search
// results read as list items, not browsing fodder.
function SearchBookRow({
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
    <View style={{ paddingHorizontal: 20, marginVertical: 6 }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 14,
          gap: 12,
          opacity: pressed ? 0.9 : 1,
          ...Platform.select({
            ios: {
              shadowColor: colors.shadow,
              shadowOpacity: 0.05,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            },
            android: { elevation: 1 },
          }),
        })}
      >
        <View
          style={{
            width: 28,
            height: 38,
            borderRadius: 3,
            backgroundColor: accent,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fonts.serif,
              fontSize: 16,
              fontWeight: '600',
              color: colors.text,
            }}
            numberOfLines={2}
          >
            {book.title}
          </Text>
          {book.author && (
            <Text
              style={{
                fontFamily: fonts.sans,
                color: colors.textMuted,
                fontSize: 13,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {book.author}
            </Text>
          )}
        </View>
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 12,
            color: colors.textSubtle,
            fontWeight: '600',
          }}
        >
          {count}
        </Text>
      </Pressable>
    </View>
  );
}
