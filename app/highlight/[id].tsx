import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import type { HighlightWithRelations } from '@/src/db/types';
import { confirm } from '@/src/components/ConfirmDialog';
import { useTheme } from '@/src/theme/ThemeContext';

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
      router.back();
    }
  };

  const labelStyle = { color: colors.textMuted, fontSize: 13, fontWeight: '500' as const, marginBottom: 4 };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 20 }}
    >
      <Text
        style={{
          fontSize: 19,
          lineHeight: 27,
          color: hl.styleParsed?.color ?? colors.text,
          fontStyle: hl.styleParsed?.italic ? 'italic' : 'normal',
        }}
      >
        {hl.text}
      </Text>
      <View>
        <Text style={labelStyle}>From</Text>
        <Pressable onPress={() => router.push(`/book/${hl.book.id}`)}>
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '500' }}>
            {hl.book.title}{hl.book.author ? ` — ${hl.book.author}` : ''}
          </Text>
        </Pressable>
      </View>
      {hl.tags.length > 0 && (
        <View>
          <Text style={labelStyle}>Tags</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {hl.tags.map((t) => (
              <View
                key={t.id}
                style={{
                  backgroundColor: colors.surfaceAlt,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '500' }}>
                  #{t.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {hl.note && (
        <View>
          <Text style={labelStyle}>Note</Text>
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{hl.note}</Text>
        </View>
      )}
      <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
        Saved {new Date(hl.created_at).toLocaleString()}
      </Text>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Pressable onPress={() => router.push({ pathname: '/review', params: { id: String(hid) } })}>
          <Text style={{ color: colors.primary, fontWeight: '500' }}>Edit</Text>
        </Pressable>
        <Pressable onPress={onDelete}>
          <Text style={{ color: colors.danger, fontWeight: '500' }}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
