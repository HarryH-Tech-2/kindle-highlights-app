import '@testing-library/jest-native/extend-expect';

// Mock ML Kit OCR — native module is not available in Jest
jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: {
    recognize: jest.fn(async () => ({ text: '', blocks: [] }))
  }
}));

// Mock expo-file-system + expo-sharing for export tests
jest.mock('expo-file-system', () => ({
  cacheDirectory: '/tmp/cache/',
  writeAsStringAsync: jest.fn(async () => undefined),
  EncodingType: { UTF8: 'utf8' }
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(async () => undefined),
  isAvailableAsync: jest.fn(async () => true)
}));
