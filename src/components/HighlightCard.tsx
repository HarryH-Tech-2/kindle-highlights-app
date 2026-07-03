import { View, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { HighlightWithRelations } from '@/src/db/types';
import { useTheme } from '@/src/theme/ThemeContext';
import { accentFor, fonts, fontFamilyFor } from '@/src/theme/colors';

// Replaces straight quotes / hyphens with their typographic equivalents
// so book quotes read like book quotes, not like log lines.
function typographicQuotes(s: string): string {
  return s
    .replace(/(^|[\s(\[{<"])'/g, '$1\u2018')
    .replace(/'/g, '\u2019')
    .replace(/(^|[\s(\[{<'])"/g, '$1\u201C')
    .replace(/"/g, '\u201D')
    .replace(/--/g, '\u2014');
}

export function HighlightCard({
  highlight,
  onPress,
  showSource = false,
}: {
  highlight: HighlightWithRelations;
  onPress?: () => void;
  // When true, renders the book title underneath the quote. Used on the
  // home feed where highlights from many books are mixed.
  showSource?: boolean;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const accent = accentFor(highlight.book.title, colors.accentPalette);
  const styleColor = highlight.styleParsed?.color ?? colors.text;
  const text = typographicQuotes(highlight.text);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginVertical: 8,
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        // Soft, paper-like elevation rather than a hard border.
        ...Platform.select({
          ios: {
            shadowColor: colors.shadow,
            shadowOpacity: 0.06,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 4 },
          },
          android: { elevation: 2 },
        }),
        transform: [{ scale: pressed ? 0.995 : 1 }],
        opacity: pressed ? 0.95 : 1,
      })}
    >
      {/* Hair-thin accent stripe down the left edge — the only color tie
          back to the source book. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 16,
          bottom: 16,
          width: 2,
          backgroundColor: accent,
          borderTopRightRadius: 2,
          borderBottomRightRadius: 2,
          opacity: 0.85,
        }}
      />

      <View style={{ padding: 20, paddingLeft: 22 }}>
        <Text
          numberOfLines={5}
          style={{
            fontFamily: fontFamilyFor(highlight.styleParsed?.font),
            fontSize: 17,
            lineHeight: 26,
            color: styleColor,
            fontStyle: highlight.styleParsed?.italic ? 'italic' : 'normal',
          }}
        >
          {text}
        </Text>

        {showSource && (
          <Text
            numberOfLines={1}
            style={{
              marginTop: 12,
              fontFamily: fonts.sans,
              fontSize: 12,
              letterSpacing: 0.3,
              color: colors.textMuted,
            }}
          >
            — {highlight.book.title}
            {highlight.book.author ? `, ${highlight.book.author}` : ''}
          </Text>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 12,
            gap: 6,
          }}
        >
          {highlight.tags.length > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                flex: 1,
              }}
            >
              {highlight.tags.slice(0, 4).map((t) => {
                const tagAccent = accentFor(t.name, colors.accentPalette);
                return (
                  <View
                    key={t.id}
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: tagAccent + '1a',
                    }}
                  >
                    <Text
                      style={{
                        color: tagAccent,
                        fontFamily: fonts.sans,
                        fontSize: 11,
                        fontWeight: '600',
                        letterSpacing: 0.2,
                      }}
                    >
                      {t.name}
                    </Text>
                  </View>
                );
              })}
              {highlight.tags.length > 4 && (
                <Text
                  style={{
                    color: colors.textSubtle,
                    fontSize: 11,
                    fontWeight: '600',
                    alignSelf: 'center',
                  }}
                >
                  +{highlight.tags.length - 4}
                </Text>
              )}
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {/* Beautify shortcut — stopPropagation so tapping the pill doesn't
              also fire the card's onPress. */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/beautify/${highlight.id}`);
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
  );
}
