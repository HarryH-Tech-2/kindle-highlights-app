import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Book } from '@/src/db/types';
import { useTheme } from '@/src/theme/ThemeContext';
import { accentFor } from '@/src/theme/colors';

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
  const { colors } = useTheme();
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

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.bg,
    fontSize: 15,
  } as const;

  if (creating) {
    const canCreate = newTitle.trim().length > 0;
    return (
      <View style={{ gap: 10 }}>
        <TextInput
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="Title"
          placeholderTextColor={colors.textSubtle}
          autoFocus
          style={inputStyle}
        />
        <TextInput
          value={newAuthor}
          onChangeText={setNewAuthor}
          placeholder="Author (optional)"
          placeholderTextColor={colors.textSubtle}
          style={inputStyle}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={async () => {
              if (!canCreate) return;
              const b = await onCreate(newTitle.trim(), newAuthor.trim() || null);
              onSelect(b.id);
              setCreating(false);
              setNewTitle('');
              setNewAuthor('');
            }}
            disabled={!canCreate}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: canCreate ? colors.primary : colors.border,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: canCreate ? colors.primaryText : colors.textSubtle,
                fontWeight: '600',
                fontSize: 15,
              }}
            >
              Create book
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setCreating(false);
              setNewTitle('');
              setNewAuthor('');
            }}
            style={({ pressed }) => ({
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: colors.textMuted, fontWeight: '500', fontSize: 15 }}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {/* Search input with leading icon */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 10,
          backgroundColor: colors.bg,
        }}
      >
        <Ionicons name="search" size={16} color={colors.textSubtle} />
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Search books"
          placeholderTextColor={colors.textSubtle}
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingLeft: 8,
            color: colors.text,
            fontSize: 15,
          }}
        />
        {filter.length > 0 && (
          <Pressable onPress={() => setFilter('')} hitSlop={10}>
            <Ionicons name="close-circle" size={16} color={colors.textSubtle} />
          </Pressable>
        )}
      </View>

      {/* Results list */}
      <View
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          maxHeight: 220,
          overflow: 'hidden',
        }}
      >
        {filtered.length === 0 ? (
          <Text
            style={{
              color: colors.textSubtle,
              fontSize: 14,
              textAlign: 'center',
              paddingVertical: 18,
            }}
          >
            No books match "{filter}".
          </Text>
        ) : (
          filtered.map((b, i) => {
            const isSelected = b.id === selectedId;
            const accent = accentFor(b.title, colors.accentPalette);
            return (
              <Pressable
                key={b.id}
                onPress={() => onSelect(b.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  gap: 12,
                  backgroundColor: isSelected
                    ? colors.primary + '14'
                    : pressed
                    ? colors.surfaceAlt
                    : 'transparent',
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                })}
              >
                <View style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: accent }} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 15,
                      fontWeight: isSelected ? '600' : '500',
                    }}
                    numberOfLines={1}
                  >
                    {b.title}
                  </Text>
                  {b.author && (
                    <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                      {b.author}
                    </Text>
                  )}
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </Pressable>
            );
          })
        )}
      </View>

      {/* Add-new affordance */}
      <Pressable
        onPress={() => setCreating(true)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 4,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
          New book
        </Text>
      </Pressable>

      {selected && (
        <Text style={{ color: colors.textSubtle, fontSize: 12 }}>
          Selected: {selected.title}
        </Text>
      )}
    </View>
  );
}
