import TextRecognition from '@react-native-ml-kit/text-recognition';

export async function recognizeFromUri(uri: string): Promise<string> {
  const result = await TextRecognition.recognize(uri);
  return (result?.text ?? '').trim();
}
