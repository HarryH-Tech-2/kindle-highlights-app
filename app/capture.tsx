import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { extractHighlightedText } from '@/src/ocr/highlight';
import { getDb } from '@/src/db/client';
import { incrementUsageCount } from '@/src/db/meta';
import { useTheme } from '@/src/theme/ThemeContext';

// This screen runs OCR only. The camera launch + permission/quota gating
// lives in the library FAB so there's no transition screen between tapping
// the FAB and the system camera coming up. We arrive here with a `uri` from
// the camera, extract the highlight, then forward to /review.

export default function Capture() {
  const router = useRouter();
  const { colors } = useTheme();
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  // Guard against the effect re-running (e.g. from a re-render) and kicking
  // off a second extraction for the same photo.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      if (!uri) {
        Alert.alert('Capture failed', 'No photo was provided.');
        router.back();
        return;
      }
      try {
        const result = await extractHighlightedText(uri);
        // Discard the photo whether or not extraction succeeded.
        try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}

        if (!result.ok) {
          const { title, message } = describeFailure(result.reason);
          const detail = 'detail' in result && result.detail ? `\n\n(${result.detail})` : '';
          Alert.alert(title, message + detail);
          router.back();
          return;
        }
        // Only count successful extractions against the free quota.
        const db = await getDb();
        await incrementUsageCount(db);
        router.replace({ pathname: '/review', params: { text: result.text } });
      } catch (e: any) {
        console.warn('[capture] failed', e);
        Alert.alert('Capture failed', e?.message ?? 'Unknown error');
        router.back();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 16,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>
        Extracting text…
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>
        This usually takes a few seconds.
      </Text>
    </View>
  );
}

function describeFailure(reason: 'no-highlight' | 'no-api-key' | 'api-error' | 'network') {
  switch (reason) {
    case 'no-highlight':
      return {
        title: 'No highlight detected',
        message: 'Highlight a passage on your Kindle, frame the screen, and try again.',
      };
    case 'no-api-key':
      return {
        title: 'Missing API key',
        message: 'Set EXPO_PUBLIC_ANTHROPIC_API_KEY in your .env file and rebuild.',
      };
    case 'network':
      return {
        title: 'No connection',
        message: 'Could not reach the Anthropic API. Check your internet connection and try again.',
      };
    case 'api-error':
    default:
      return {
        title: 'Extraction failed',
        message: 'The extraction service returned an error. Try again in a moment.',
      };
  }
}
