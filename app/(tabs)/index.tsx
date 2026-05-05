import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getDb } from '@/src/db/client';
import * as Books from '@/src/db/books';
import { search } from '@/src/db/search';
import type { Book, HighlightWithRelations } from '@/src/db/types';
import { EmptyState } from '@/src/components/EmptyState';
import { HighlightCard } from '@/src/components/HighlightCard';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function Library() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [searchHighlights, setSearchHighlights] = useState<HighlightWithRelations[]>([]);
  const [searchBooks, setSearchBooks] = useState<Book[]>([]);

  const load = useCallback(async () => {
    const db = await getDb();
    setBooks(await Books.listBooks(db));
    const rows = await db.getAllAsync<{ book_id: number; c: number }>(
      'SELECT book_id, COUNT(*) AS c FROM highlights GROUP BY book_id'
    );
    setCounts(Object.fromEntries(rows.map((r) => [r.book_id, r.c])));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!query.trim()) { setSearchHighlights([]); setSearchBooks([]); return; }
      const db = await getDb();
      const r = await search(db, query);
      if (cancelled) return;
      setSearchHighlights(r.highlights);
      setSearchBooks(r.books);
    })();
    return () => { cancelled = true; };
  }, [query]);

  const showingSearch = query.trim().length > 0;

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search highlights and books"
        style={{ margin: 12, padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 8 }}
      />
      {showingSearch ? (
        searchHighlights.length === 0 && searchBooks.length === 0 ? (
          <EmptyState message={`Nothing matches "${query}".`} />
        ) : (
          <FlatList
            data={[
              ...searchBooks.map((b) => ({ kind: 'book' as const, book: b })),
              ...searchHighlights.map((h) => ({ kind: 'hl' as const, hl: h }))
            ]}
            keyExtractor={(item) => (item.kind === 'book' ? `b${item.book.id}` : `h${item.hl.id}`)}
            renderItem={({ item }) =>
              item.kind === 'book' ? (
                <Pressable
                  onPress={() => router.push(`/book/${item.book.id}`)}
                  style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}
                >
                  <Text style={{ fontWeight: '600' }}>{item.book.title}</Text>
                  {item.book.author && <Text style={{ color: '#666' }}>{item.book.author}</Text>}
                </Pressable>
              ) : (
                <HighlightCard
                  highlight={item.hl}
                  onPress={() => router.push(`/highlight/${item.hl.id}`)}
                />
              )
            }
          />
        )
      ) : books.length === 0 ? (
        <EmptyState message="No highlights yet. Tap the camera to capture your first one." />
      ) : (
        <FlatList
          data={books}
          keyExtractor={(b) => String(b.id)}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/book/${item.id}`)}
              style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}
            >
              <Text style={{ fontWeight: '600', fontSize: 16 }}>{item.title}</Text>
              {item.author && <Text style={{ color: '#666' }}>{item.author}</Text>}
              <Text style={{ color: '#999', marginTop: 2 }}>
                {counts[item.id] ?? 0} highlight{(counts[item.id] ?? 0) === 1 ? '' : 's'}
              </Text>
            </Pressable>
          )}
        />
      )}

      <Pressable
        onPress={() => router.push('/capture')}
        style={{
          position: 'absolute',
          right: 24,
          bottom: 32,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: '#007aff',
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4
        }}
      >
        <Ionicons name="camera" color="#fff" size={28} />
      </Pressable>
    </View>
  );
}
