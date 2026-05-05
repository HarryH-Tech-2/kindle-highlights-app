import { View, Text, Pressable } from 'react-native';
import type { HighlightWithRelations } from '@/src/db/types';

export function HighlightCard({
  highlight,
  onPress
}: {
  highlight: HighlightWithRelations;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}>
      <Text numberOfLines={4} style={{ fontSize: 15 }}>{highlight.text}</Text>
      {highlight.tags.length > 0 && (
        <Text style={{ marginTop: 6, color: '#888' }}>
          {highlight.tags.map((t) => `#${t.name}`).join(' ')}
        </Text>
      )}
    </Pressable>
  );
}
