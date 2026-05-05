import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import type { HighlightWithRelations } from '@/src/db/types';
import { confirm } from '@/src/components/ConfirmDialog';

export default function HighlightDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hid = Number(id);
  const [hl, setHl] = useState<HighlightWithRelations | null>(null);

  const load = useCallback(async () => {
    const db = await getDb();
    setHl(await Highlights.getHighlight(db, hid));
  }, [hid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!hl) return <View />;

  const onDelete = async () => {
    if (await confirm({
      title: 'Delete highlight?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true
    })) {
      await Highlights.deleteHighlight(await getDb(), hid);
      router.back();
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 18 }}>{hl.text}</Text>
      <View>
        <Text style={{ color: '#666' }}>From</Text>
        <Pressable onPress={() => router.push(`/book/${hl.book.id}`)}>
          <Text style={{ color: '#007aff', fontSize: 16 }}>
            {hl.book.title}{hl.book.author ? ` — ${hl.book.author}` : ''}
          </Text>
        </Pressable>
      </View>
      {hl.tags.length > 0 && (
        <View>
          <Text style={{ color: '#666' }}>Tags</Text>
          <Text>{hl.tags.map((t) => `#${t.name}`).join(' ')}</Text>
        </View>
      )}
      {hl.note && (
        <View>
          <Text style={{ color: '#666' }}>Note</Text>
          <Text>{hl.note}</Text>
        </View>
      )}
      <Text style={{ color: '#999' }}>Saved {new Date(hl.created_at).toLocaleString()}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={() => router.push({ pathname: '/review', params: { id: String(hid) } })}>
          <Text style={{ color: '#007aff' }}>Edit</Text>
        </Pressable>
        <Pressable onPress={onDelete}>
          <Text style={{ color: '#c00' }}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
