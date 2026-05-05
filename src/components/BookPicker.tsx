import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import type { Book } from '@/src/db/types';

export function BookPicker({
  books,
  selectedId,
  onSelect,
  onCreate
}: {
  books: Book[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreate: (title: string, author: string | null) => Promise<Book>;
}) {
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) => b.title.toLowerCase().includes(q));
  }, [books, filter]);

  const selected = books.find((b) => b.id === selectedId) ?? null;

  if (creating) {
    return (
      <View style={{ gap: 8 }}>
        <TextInput
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="Title"
          style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
        />
        <TextInput
          value={newAuthor}
          onChangeText={setNewAuthor}
          placeholder="Author (optional)"
          style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={async () => {
              if (!newTitle.trim()) return;
              const b = await onCreate(newTitle.trim(), newAuthor.trim() || null);
              onSelect(b.id);
              setCreating(false);
              setNewTitle('');
              setNewAuthor('');
            }}
            style={{ padding: 10, backgroundColor: '#007aff', borderRadius: 8 }}
          >
            <Text style={{ color: '#fff' }}>Create</Text>
          </Pressable>
          <Pressable onPress={() => setCreating(false)} style={{ padding: 10 }}>
            <Text>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={{ marginBottom: 4 }}>
        {selected ? `Selected: ${selected.title}` : 'Pick a book'}
      </Text>
      <TextInput
        value={filter}
        onChangeText={setFilter}
        placeholder="Search books"
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 8 }}
      />
      <View style={{ maxHeight: 200 }}>
        {filtered.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => onSelect(b.id)}
            style={{
              padding: 10,
              backgroundColor: b.id === selectedId ? '#eef' : 'transparent',
              borderRadius: 6
            }}
          >
            <Text>{b.title}</Text>
            {b.author && <Text style={{ color: '#888' }}>{b.author}</Text>}
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => setCreating(true)} style={{ padding: 10 }}>
        <Text style={{ color: '#007aff' }}>+ New book</Text>
      </Pressable>
    </View>
  );
}
