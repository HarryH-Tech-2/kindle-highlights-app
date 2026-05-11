import { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import * as Tags from '@/src/db/tags';
import type { HighlightStyle } from '@/src/db/types';
import { useBooks } from '@/src/hooks/useBooks';
import { BookPicker } from '@/src/components/BookPicker';
import { TagInput } from '@/src/components/TagInput';
import { HighlightStylePicker } from '@/src/components/HighlightStylePicker';
import { confirm } from '@/src/components/ConfirmDialog';
import { useTheme } from '@/src/theme/ThemeContext';

export default function Review() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ text?: string; id?: string }>();
  const editingId = params.id ? Number(params.id) : null;

  const { books, create: createBook, refresh: refreshBooks } = useBooks();
  const [text, setText] = useState(params.text ?? '');
  const [bookId, setBookId] = useState<number | null>(null);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [style, setStyle] = useState<HighlightStyle | null>(null);
  const [allTagNames, setAllTagNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(editingId != null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const t = await Tags.listTags(db);
      setAllTagNames(t.map((x) => x.name));
      if (editingId != null) {
        const h = await Highlights.getHighlight(db, editingId);
        if (h) {
          setText(h.text);
          setBookId(h.book_id);
          setTagNames(h.tags.map((tg) => tg.name));
          setNote(h.note ?? '');
          setStyle(h.styleParsed);
        }
        setLoading(false);
      }
    })();
  }, [editingId]);

  const canSave = text.trim().length > 0 && bookId != null && !saving;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editingId != null) {
        await Highlights.updateHighlight(await getDb(), editingId, {
          text: text.trim(),
          note: note.trim() || null,
          tag_names: tagNames,
          style,
        });
      } else {
        await Highlights.createHighlight(await getDb(), {
          book_id: bookId!,
          text: text.trim(),
          note: note.trim() || null,
          tag_names: tagNames,
          style,
        });
      }
      router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = async () => {
    if (await confirm({
      title: 'Discard?',
      message: 'Your changes will be lost.',
      confirmLabel: 'Discard',
      destructive: true
    })) {
      router.replace('/');
    }
  };

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.primary} /></View>;
  }

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: 'top' as const,
  };

  const labelStyle = { fontWeight: '600' as const, marginBottom: 6, color: colors.text };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <View>
        <Text style={labelStyle}>Highlight text</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholderTextColor={colors.textSubtle}
          style={{
            ...inputStyle,
            minHeight: 120,
            // Surface the chosen style directly on the highlight text so the
            // picker below acts as a live editor rather than a preview.
            color: style?.color ?? colors.text,
            fontStyle: style?.italic ? 'italic' : 'normal',
          }}
        />
      </View>

      <View>
        <Text style={labelStyle}>Book</Text>
        <BookPicker
          books={books}
          selectedId={bookId}
          onSelect={setBookId}
          onCreate={async (title, author) => {
            const b = await createBook({ title, author });
            await refreshBooks();
            return b;
          }}
        />
      </View>

      <View>
        <Text style={labelStyle}>Tags</Text>
        <TagInput value={tagNames} onChange={setTagNames} suggestions={allTagNames} />
      </View>

      <View>
        <Text style={labelStyle}>Style</Text>
        <HighlightStylePicker value={style} onChange={setStyle} />
      </View>

      <View>
        <Text style={labelStyle}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholderTextColor={colors.textSubtle}
          style={{ ...inputStyle, minHeight: 60 }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={onSave}
          disabled={!canSave}
          style={{
            flex: 1, padding: 14, borderRadius: 10,
            backgroundColor: canSave ? colors.primary : colors.border,
            alignItems: 'center'
          }}
        >
          <Text style={{ color: canSave ? colors.primaryText : colors.textSubtle, fontWeight: '600' }}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDiscard}
          style={{
            flex: 1, padding: 14, borderRadius: 10,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center'
          }}
        >
          <Text style={{ color: colors.danger, fontWeight: '600' }}>Discard</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
