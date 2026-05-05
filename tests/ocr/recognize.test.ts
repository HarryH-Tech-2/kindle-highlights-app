import TextRecognition from '@react-native-ml-kit/text-recognition';
import { recognizeFromUri } from '../../src/ocr/recognize';

describe('recognizeFromUri', () => {
  test('returns the joined text from ML Kit blocks', async () => {
    (TextRecognition.recognize as jest.Mock).mockResolvedValueOnce({
      text: 'Block one.\nBlock two.',
      blocks: []
    });
    const out = await recognizeFromUri('file:///tmp/photo.jpg');
    expect(out).toBe('Block one.\nBlock two.');
  });

  test('returns empty string when no text detected', async () => {
    (TextRecognition.recognize as jest.Mock).mockResolvedValueOnce({ text: '', blocks: [] });
    const out = await recognizeFromUri('file:///tmp/empty.jpg');
    expect(out).toBe('');
  });

  test('trims surrounding whitespace', async () => {
    (TextRecognition.recognize as jest.Mock).mockResolvedValueOnce({
      text: '\n\n  hello  \n',
      blocks: []
    });
    expect(await recognizeFromUri('file:///x')).toBe('hello');
  });
});
