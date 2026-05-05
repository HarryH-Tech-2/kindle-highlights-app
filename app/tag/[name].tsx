import { useCallback, useState } from 'react';
import { View, FlatList, Pressable, Text } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import type { HighlightWithRelations } from '@/src/db/types';
import { HighlightCard } from '@/src/components/HighlightCard';
import { renderTagExport } from '@/src/export/markdown';
import { shareMarkdown } from '@/src/export/share';

export default function TagDetail() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const tagName = decodeURIComponent(String(name));
  const [items, setItems] = useState<HighlightWithRelations[]>([]);

  const load = useCallback(async () => {
    const db = await getDb();
    setItems(await Highlights.listHighlightsByTag(db, tagName));
  }, [tagName]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '600' }}>#{tagName}</Text>
        <Pressable onPress={async () => shareMarkdown(`tag-${tagName}`, renderTagExport(tagName, items))}>
          <Text style={{ color: '#007aff' }}>Export</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(h) => String(h.id)}
        renderItem={({ item }) => (
          <HighlightCard highlight={item} onPress={() => router.push(`/highlight/${item.id}`)} />
        )}
      />
    </View>
  );
}
