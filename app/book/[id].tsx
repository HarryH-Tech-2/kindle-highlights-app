import { useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getDb } from '@/src/db/client';
import * as Books from '@/src/db/books';
import * as Highlights from '@/src/db/highlights';
import type { Book, HighlightWithRelations } from '@/src/db/types';
import { renderBookExport } from '@/src/export/markdown';
import { shareMarkdown } from '@/src/export/share';
import { confirm } from '@/src/components/ConfirmDialog';
import { HighlightCard } from '@/src/components/HighlightCard';

export default function BookDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = Number(id);
  const [book, setBook] = useState<Book | null>(null);
  const [highlights, setHighlights] = useState<HighlightWithRelations[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');

  const load = useCallback(async () => {
    const db = await getDb();
    const b = await Books.getBook(db, bookId);
    setBook(b);
    if (b) { setTitle(b.title); setAuthor(b.author ?? ''); }
    setHighlights(await Highlights.listHighlightsByBook(db, bookId));
  }, [bookId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!book) return <View />;

  const onSaveEdit = async () => {
    const db = await getDb();
    const updated = await Books.updateBook(db, bookId, {
      title: title.trim() || book.title,
      author: author.trim() || null
    });
    setBook(updated);
    setEditing(false);
  };

  const onDelete = async () => {
    if (await confirm({
      title: 'Delete book?',
      message: `This will delete the book and its ${highlights.length} highlight${highlights.length === 1 ? '' : 's'}.`,
      confirmLabel: 'Delete',
      destructive: true
    })) {
      const db = await getDb();
      await Books.deleteBook(db, bookId);
      router.replace('/');
    }
  };

  const onExport = async () => {
    const md = renderBookExport(book, highlights);
    await shareMarkdown(book.title, md);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}>
        {editing ? (
          <View style={{ gap: 8 }}>
            <TextInput value={title} onChangeText={setTitle} placeholder="Title"
              style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }} />
            <TextInput value={author} onChangeText={setAuthor} placeholder="Author"
              style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={onSaveEdit}
                style={{ padding: 10, backgroundColor: '#007aff', borderRadius: 8 }}>
                <Text style={{ color: '#fff' }}>Save</Text>
              </Pressable>
              <Pressable onPress={() => setEditing(false)} style={{ padding: 10 }}>
                <Text>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setEditing(true)}>
            <Text style={{ fontSize: 22, fontWeight: '600' }}>{book.title}</Text>
            {book.author && <Text style={{ color: '#666' }}>{book.author}</Text>}
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <Pressable onPress={onExport}><Text style={{ color: '#007aff' }}>Export Markdown</Text></Pressable>
          <Pressable onPress={onDelete}><Text style={{ color: '#c00' }}>Delete book</Text></Pressable>
        </View>
      </View>
      <FlatList
        data={highlights}
        keyExtractor={(h) => String(h.id)}
        renderItem={({ item }) => (
          <HighlightCard highlight={item} onPress={() => router.push(`/highlight/${item.id}`)} />
        )}
        ListEmptyComponent={<Text style={{ padding: 24, color: '#666' }}>No highlights yet for this book.</Text>}
      />
    </View>
  );
}
