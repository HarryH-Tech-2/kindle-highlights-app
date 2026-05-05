import { View, Text, Pressable, Alert } from 'react-native';
import Constants from 'expo-constants';
import { getDb } from '@/src/db/client';
import * as Books from '@/src/db/books';
import * as Highlights from '@/src/db/highlights';
import { renderLibrary } from '@/src/export/markdown';
import { shareMarkdown } from '@/src/export/share';

export default function Settings() {
  const exportAll = async () => {
    try {
      const db = await getDb();
      const books = await Books.listBooks(db);
      const sections = await Promise.all(
        books.map(async (book) => ({
          book,
          highlights: await Highlights.listHighlightsByBook(db, book.id)
        }))
      );
      const md = renderLibrary(sections.filter((s) => s.highlights.length > 0));
      if (!md.trim()) {
        Alert.alert('Nothing to export', 'You have no highlights yet.');
        return;
      }
      await shareMarkdown('all-highlights', md);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Unknown error');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Pressable onPress={exportAll} style={{ padding: 14, backgroundColor: '#007aff', borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Export all highlights (Markdown)</Text>
      </Pressable>
      <View>
        <Text style={{ color: '#666' }}>About</Text>
        <Text>Kindle Highlights v{Constants.expoConfig?.version ?? '0.0.0'}</Text>
        <Text style={{ color: '#666' }}>All data is stored locally on this device.</Text>
      </View>
    </View>
  );
}
