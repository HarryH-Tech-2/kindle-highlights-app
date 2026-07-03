import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import type { HighlightWithRelations } from '@/src/db/types';
import { confirm } from '@/src/components/ConfirmDialog';
import { useTheme } from '@/src/theme/ThemeContext';
import { accentFor, fonts, fontFamilyFor } from '@/src/theme/colors';
import { scheduleSync } from '@/src/sync/scheduler';

function typographicQuotes(s: string): string {
  return s
    .replace(/(^|[\s(\[{<"])'/g, '$1\u2018')
    .replace(/'/g, '\u2019')
    .replace(/(^|[\s(\[{<'])"/g, '$1\u201C')
    .replace(/"/g, '\u201D')
    .replace(/--/g, '\u2014');
}

export default function HighlightDetail() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hid = Number(id);
  const [hl, setHl] = useState<HighlightWithRelations | null>(null);

  const load = useCallback(async () => {
    const db = await getDb();
    setHl(await Highlights.getHighlight(db, hid));
  }, [hid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!hl) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const onDelete = async () => {
    if (await confirm({
      title: 'Delete highlight?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true
    })) {
      await Highlights.deleteHighlight(await getDb(), hid);
      scheduleSync();
      router.back();
    }
  };

  const onShare = async () => {
    const attribution = hl.book.author
      ? `\n\n\u2014 ${hl.book.title}, ${hl.book.author}`
      : `\n\n\u2014 ${hl.book.title}`;
    try {
      await Share.share({ message: `\u201C${hl.text}\u201D${attribution}` });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  };

  const bookAccent = accentFor(hl.book.title, colors.accentPalette);
  const highlightColor = hl.styleParsed?.color ?? colors.text;
  const savedLabel = new Date(hl.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const text = typographicQuotes(hl.text);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 18 }}
      >
        {/* Hero card — the highlight text itself. No border, soft elevation,
            giant background quote glyph. Reads as a page from a notebook. */}
        <View
          style={{
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
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 28,
              bottom: 28,
              width: 3,
              backgroundColor: bookAccent,
              borderTopRightRadius: 3,
              borderBottomRightRadius: 3,
            }}
          />
          <View style={{ padding: 28, paddingLeft: 30 }}>
            <Text
              selectable
              style={{
                fontFamily: fontFamilyFor(hl.styleParsed?.font),
                fontSize: 22,
                lineHeight: 34,
                color: highlightColor,
                fontStyle: hl.styleParsed?.italic ? 'italic' : 'normal',
              }}
            >
              {text}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 18,
                gap: 8,
              }}
            >
              <View style={{ width: 22, height: 1, backgroundColor: bookAccent }} />
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 12,
                  color: colors.textMuted,
                  fontWeight: '600',
                  letterSpacing: 0.3,
                }}
                numberOfLines={1}
              >
                {hl.book.title}
                {hl.book.author ? `, ${hl.book.author}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Source book — tappable, leads to the book detail page. */}
        <Pressable
          onPress={() => router.push(`/book/${hl.book.id}`)}
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
              width: 32,
              height: 44,
              borderRadius: 3,
              backgroundColor: bookAccent,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: fonts.sans,
                color: colors.textSubtle,
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
              }}
            >
              From
            </Text>
            <Text
              style={{
                fontFamily: fonts.serif,
                color: colors.text,
                fontSize: 16,
                fontWeight: '600',
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {hl.book.title}
            </Text>
            {hl.book.author && (
              <Text
                style={{
                  fontFamily: fonts.sans,
                  color: colors.textMuted,
                  fontSize: 13,
                  marginTop: 1,
                }}
                numberOfLines={1}
              >
                {hl.book.author}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </Pressable>

        {/* Tags — tonal fills, no borders. */}
        {hl.tags.length > 0 && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 14,
              gap: 10,
              ...Platform.select({
                ios: {
                  shadowColor: colors.shadow,
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                },
                android: { elevation: 1 },
              }),
            }}
          >
            <Text
              style={{
                fontFamily: fonts.sans,
                color: colors.textSubtle,
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
              }}
            >
              Tags
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {hl.tags.map((t) => {
                const accent = accentFor(t.name, colors.accentPalette);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => router.push(`/tag/${encodeURIComponent(t.name)}`)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 11,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: accent + '1f',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.sans,
                        color: accent,
                        fontSize: 13,
                        fontWeight: '600',
                        letterSpacing: 0.2,
                      }}
                    >
                      {t.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Note — only shown if the user has written one. */}
        {hl.note && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              gap: 8,
              ...Platform.select({
                ios: {
                  shadowColor: colors.shadow,
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                },
                android: { elevation: 1 },
              }),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="create" size={13} color={colors.textMuted} />
              <Text
                style={{
                  fontFamily: fonts.sans,
                  color: colors.textSubtle,
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                Note
              </Text>
            </View>
            <Text
              selectable
              style={{
                fontFamily: fonts.serif,
                color: colors.text,
                fontSize: 16,
                lineHeight: 24,
              }}
            >
              {hl.note}
            </Text>
          </View>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 4,
          }}
        >
          <Ionicons name="time-outline" size={12} color={colors.textSubtle} />
          <Text
            style={{
              fontFamily: fonts.sans,
              color: colors.textSubtle,
              fontSize: 12,
            }}
          >
            Saved {savedLabel}
          </Text>
        </View>
      </ScrollView>

      {/* Sticky action bar. Beautify is now the primary action — that's the
          app's differentiator, so it deserves the front-and-center treatment.
          Edit/share/delete sit alongside as icon-only secondaries. */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 12,
          backgroundColor: colors.bg,
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => router.push(`/beautify/${hid}`)}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 14,
            borderRadius: 999,
            backgroundColor: colors.primary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: pressed ? 0.92 : 1,
            ...Platform.select({
              ios: {
                shadowColor: colors.primary,
                shadowOpacity: 0.28,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 5 },
              },
              android: { elevation: 4 },
            }),
          })}
        >
          <Ionicons name="sparkles" size={17} color={colors.primaryText} />
          <Text
            style={{
              fontFamily: fonts.sans,
              color: colors.primaryText,
              fontWeight: '700',
              fontSize: 15,
              letterSpacing: 0.3,
            }}
          >
            Beautify
          </Text>
        </Pressable>
        <IconButton
          icon="pencil"
          color={colors.text}
          onPress={() => router.push({ pathname: '/review', params: { id: String(hid) } })}
          colors={colors}
        />
        <IconButton
          icon="share-outline"
          color={colors.text}
          onPress={onShare}
          colors={colors}
        />
        <IconButton
          icon="trash-outline"
          color={colors.danger}
          onPress={onDelete}
          colors={colors}
        />
      </View>
    </View>
  );
}

function IconButton({
  icon,
  color,
  onPress,
  colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: 999,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
        ...Platform.select({
          ios: {
            shadowColor: colors.shadow,
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          },
          android: { elevation: 1 },
        }),
      })}
    >
      <Ionicons name={icon} size={19} color={color} />
    </Pressable>
  );
}
