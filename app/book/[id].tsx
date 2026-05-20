import { useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from '@/src/db/client';
import * as Books from '@/src/db/books';
import * as Highlights from '@/src/db/highlights';
import type { Book, HighlightWithRelations } from '@/src/db/types';
import { renderBookExport } from '@/src/export/markdown';
import { shareMarkdown } from '@/src/export/share';
import { confirm } from '@/src/components/ConfirmDialog';
import { HighlightCard } from '@/src/components/HighlightCard';
import { EmptyState } from '@/src/components/EmptyState';
import { useTheme } from '@/src/theme/ThemeContext';
import { accentFor, fonts } from '@/src/theme/colors';
import { scheduleSync } from '@/src/sync/scheduler';

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
    scheduleSync();
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
      scheduleSync();
      router.replace('/');
    }
  };

  const onExport = async () => {
    const md = renderBookExport(book, highlights);
    await shareMarkdown(book.title, md);
  };

  const accent = accentFor(book.title, colors.accentPalette);

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    backgroundColor: colors.surface,
    fontFamily: fonts.sans as string,
    fontSize: 15,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header — large serif title, an accent "spine" alongside for visual
          tie-in with the home shelf, no hard divider below. */}
      <View style={{ padding: 20, paddingBottom: 16 }}>
        {editing ? (
          <View style={{ gap: 10 }}>
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
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={onSaveEdit}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: colors.primary,
                  borderRadius: 999,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: fonts.sans,
                    color: colors.primaryText,
                    fontWeight: '700',
                    letterSpacing: 0.3,
                  }}
                >
                  Save
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setEditing(false)}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: fonts.sans,
                    color: colors.textMuted,
                    fontWeight: '600',
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setEditing(true)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 14,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {/* Accent "spine" alongside the title — same color as the shelf */}
            <View
              style={{
                width: 4,
                alignSelf: 'stretch',
                minHeight: 56,
                backgroundColor: accent,
                borderRadius: 2,
                marginTop: 4,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  color: colors.textSubtle,
                }}
              >
                {highlights.length} highlight{highlights.length === 1 ? '' : 's'}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 26,
                  lineHeight: 32,
                  color: colors.text,
                  marginTop: 4,
                  letterSpacing: -0.3,
                }}
              >
                {book.title}
              </Text>
              {book.author && (
                <Text
                  style={{
                    fontFamily: fonts.sans,
                    color: colors.textMuted,
                    fontSize: 14,
                    marginTop: 4,
                  }}
                >
                  {book.author}
                </Text>
              )}
            </View>
            <Ionicons name="pencil" size={16} color={colors.textSubtle} />
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', gap: 18, marginTop: 14, marginLeft: 18 }}>
          <Pressable onPress={onExport} hitSlop={6}>
            <Text
              style={{
                fontFamily: fonts.sans,
                color: colors.primary,
                fontWeight: '600',
                fontSize: 13,
                letterSpacing: 0.3,
              }}
            >
              Export Markdown
            </Text>
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={6}>
            <Text
              style={{
                fontFamily: fonts.sans,
                color: colors.danger,
                fontWeight: '600',
                fontSize: 13,
                letterSpacing: 0.3,
              }}
            >
              Delete book
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={highlights}
        keyExtractor={(h) => String(h.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <HighlightCard
            highlight={item}
            onPress={() => router.push(`/highlight/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="bookmark-outline"
            title="No highlights from this book yet"
            message="Capture a screenshot and pick this book on the review screen."
          />
        }
      />
    </View>
  );
}
