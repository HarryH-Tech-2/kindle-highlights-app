import { View, Text, Pressable } from 'react-native';
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
      {highlight.tags.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
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
    </Pressable>
  );
}
