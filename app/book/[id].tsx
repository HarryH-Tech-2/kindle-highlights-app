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
import { useTheme } from '@/src/theme/ThemeContext';

export default function BookDetail() {
  const router = useRouter();
  const { colors } = useTheme();
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

  if (!book) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

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

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
    backgroundColor: colors.surface,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
        {editing ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={colors.textSubtle}
              style={inputStyle}
            />
            <TextInput
              value={author}
              onChangeText={setAuthor}
              placeholder="Author"
              placeholderTextColor={colors.textSubtle}
              style={inputStyle}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={onSaveEdit}
                style={{ padding: 10, backgroundColor: colors.primary, borderRadius: 8 }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: '600' }}>Save</Text>
              </Pressable>
              <Pressable onPress={() => setEditing(false)} style={{ padding: 10 }}>
                <Text style={{ color: colors.textMuted }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setEditing(true)}>
            <Text style={{ fontSize: 22, fontWeight: '600', color: colors.text }}>
              {book.title}
            </Text>
            {book.author && (
              <Text style={{ color: colors.textMuted, marginTop: 2 }}>{book.author}</Text>
            )}
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
          <Pressable onPress={onExport}>
            <Text style={{ color: colors.primary, fontWeight: '500' }}>Export Markdown</Text>
          </Pressable>
          <Pressable onPress={onDelete}>
            <Text style={{ color: colors.danger, fontWeight: '500' }}>Delete book</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={highlights}
        keyExtractor={(h) => String(h.id)}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <HighlightCard highlight={item} onPress={() => router.push(`/highlight/${item.id}`)} />
        )}
        ListEmptyComponent={
          <Text style={{ padding: 24, color: colors.textMuted, textAlign: 'center' }}>
            No highlights yet for this book.
          </Text>
        }
      />
    </View>
  );
}
