import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, Share } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import type { HighlightWithRelations } from '@/src/db/types';
import { confirm } from '@/src/components/ConfirmDialog';
import { useTheme } from '@/src/theme/ThemeContext';
import { accentFor } from '@/src/theme/colors';
import { scheduleSync } from '@/src/sync/scheduler';

export default function HighlightDetail() {
  const router = useRouter();
  const { colors } = useTheme();
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
      ? `\n\n— ${hl.book.title}, ${hl.book.author}`
      : `\n\n— ${hl.book.title}`;
    try {
      await Share.share({ message: `"${hl.text}"${attribution}` });
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 16 }}
      >
        {/* Hero card — the highlight text itself, in the user's chosen style.
            A left accent stripe (matched to the book) ties it visually to its
            source and adds the only color on the screen by default. */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <View style={{ width: 5, backgroundColor: bookAccent }} />
          <View style={{ flex: 1, padding: 20 }}>
            <Ionicons
              name="chatbox-ellipses"
              size={18}
              color={bookAccent}
              style={{ marginBottom: 10, opacity: 0.7 }}
            />
            <Text
              selectable
              style={{
                fontSize: 20,
                lineHeight: 30,
                color: highlightColor,
                fontStyle: hl.styleParsed?.italic ? 'italic' : 'normal',
                fontWeight: '500',
              }}
            >
              {hl.text}
            </Text>
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
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            gap: 12,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: bookAccent + '22',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="book" size={18} color={bookAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textSubtle, fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' }}>
              From
            </Text>
            <Text
              style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 1 }}
              numberOfLines={1}
            >
              {hl.book.title}
            </Text>
            {hl.book.author && (
              <Text
                style={{ color: colors.textMuted, fontSize: 13, marginTop: 1 }}
                numberOfLines={1}
              >
                {hl.book.author}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </Pressable>

        {/* Tags — each one is itself tappable into the tag detail page. */}
        {hl.tags.length > 0 && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.textSubtle, fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' }}>
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
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: accent + '1f',
                      borderWidth: 1,
                      borderColor: accent + '55',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: accent, fontSize: 13, fontWeight: '600' }}>
                      #{t.name}
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
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="create" size={14} color={colors.textMuted} />
              <Text style={{ color: colors.textSubtle, fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Note
              </Text>
            </View>
            <Text
              selectable
              style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}
            >
              {hl.note}
            </Text>
          </View>
        )}

        {/* Saved meta — keep it subtle. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
          <Ionicons name="time-outline" size={13} color={colors.textSubtle} />
          <Text style={{ color: colors.textSubtle, fontSize: 12 }}>
            Saved {savedLabel}
          </Text>
        </View>
      </ScrollView>

      {/* Sticky action bar matching the review screen so the two feel like
          two sides of the same flow. Edit is the primary action; share and
          delete sit alongside as icon-only secondaries. */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Platform.OS === 'ios' ? 28 : 16,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => router.push({ pathname: '/review', params: { id: String(hid) } })}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: colors.primary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: pressed ? 0.9 : 1,
            elevation: 3,
            shadowColor: colors.primary,
            shadowOpacity: 0.3,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          })}
        >
          <Ionicons name="pencil" size={18} color={colors.primaryText} />
          <Text style={{ color: colors.primaryText, fontWeight: '600', fontSize: 16 }}>
            Edit
          </Text>
        </Pressable>
        <IconButton
          icon="sparkles"
          color={colors.primary}
          onPress={() => router.push(`/beautify/${hid}`)}
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
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}
