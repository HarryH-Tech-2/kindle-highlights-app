import { useCallback } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTagsWithCounts } from '@/src/hooks/useTags';
import { EmptyState } from '@/src/components/EmptyState';

export default function TagsList() {
  const router = useRouter();
  const { tags, refresh } = useTagsWithCounts();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  if (tags.length === 0) return <EmptyState message="Tags you add will appear here." />;

  return (
    <FlatList
      data={tags}
      keyExtractor={(t) => String(t.id)}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/tag/${encodeURIComponent(item.name)}`)}
          style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}
        >
          <Text style={{ fontSize: 16 }}>#{item.name}</Text>
          <Text style={{ color: '#999' }}>{item.count} highlight{item.count === 1 ? '' : 's'}</Text>
        </Pressable>
      )}
    />
  );
}
