import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareMarkdown(filename: string, content: string): Promise<void> {
  const safeName = filename.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 80) || 'highlights';
  const path = `${FileSystem.cacheDirectory}${safeName}-${Date.now()}.md`;
  await FileSystem.writeAsStringAsync(path, content, {
    encoding: FileSystem.EncodingType.UTF8
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'text/markdown', dialogTitle: 'Export highlights' });
  }
}
