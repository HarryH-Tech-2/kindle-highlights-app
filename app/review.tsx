import { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import * as Tags from '@/src/db/tags';
import { useBooks } from '@/src/hooks/useBooks';
import { BookPicker } from '@/src/components/BookPicker';
import { TagInput } from '@/src/components/TagInput';
import { confirm } from '@/src/components/ConfirmDialog';

export default function Review() {
  const router = useRouter();
  const params = useLocalSearchParams<{ text?: string; id?: string }>();
  const editingId = params.id ? Number(params.id) : null;

  const { books, create: createBook, refresh: refreshBooks } = useBooks();
  const [text, setText] = useState(params.text ?? '');
  const [bookId, setBookId] = useState<number | null>(null);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [note, setNote] = useState('');
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
          tag_names: tagNames
        });
      } else {
        await Highlights.createHighlight(await getDb(), {
          book_id: bookId!,
          text: text.trim(),
          note: note.trim() || null,
          tag_names: tagNames
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
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Highlight text</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          style={{
            borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10,
            minHeight: 120, textAlignVertical: 'top'
          }}
        />
      </View>

      <View>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Book</Text>
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
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Tags</Text>
        <TagInput value={tagNames} onChange={setTagNames} suggestions={allTagNames} />
      </View>

      <View>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          style={{
            borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10,
            minHeight: 60, textAlignVertical: 'top'
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={onSave}
          disabled={!canSave}
          style={{
            flex: 1, padding: 14, borderRadius: 8,
            backgroundColor: canSave ? '#007aff' : '#aac',
            alignItems: 'center'
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
        <Pressable onPress={onDiscard} style={{ padding: 14 }}>
          <Text>Discard</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
