import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { HighlightWithRelations } from '@/src/db/types';
import { useTheme } from '@/src/theme/ThemeContext';

export function HighlightCard({
  highlight,
  onPress,
}: {
  highlight: HighlightWithRelations;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 16,
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        marginVertical: 6,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        numberOfLines={4}
        style={{
          fontSize: 15,
          lineHeight: 22,
          color: highlight.styleParsed?.color ?? colors.text,
          fontStyle: highlight.styleParsed?.italic ? 'italic' : 'normal',
        }}
      >
        {highlight.text}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 10,
          gap: 6,
        }}
      >
        {highlight.tags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
            {highlight.tags.map((t) => (
              <View
                key={t.id}
                style={{
                  backgroundColor: colors.surfaceAlt,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '500' }}>
                  #{t.name}
                </Text>
              </View>
            ))}
          </View>
        )}
        {highlight.tags.length === 0 && <View style={{ flex: 1 }} />}
        <Pressable
          onPress={(e) => {
            // Don't bubble into the parent card press.
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
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
            Beautify
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
