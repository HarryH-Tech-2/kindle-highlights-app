import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { extractHighlightedText } from '@/src/ocr/highlight';
import { useTheme } from '@/src/theme/ThemeContext';

// This screen owns both the camera launch AND the OCR pass. Launching the
// camera here (rather than from the library FAB) means that after the user
// confirms their photo, the system camera dismisses straight onto this
// screen's "Extracting text…" state — they never see a frame of the home
// screen in between. The permission/quota/tips gating still lives in the
// library FAB so this screen can trust that capture is allowed.
//
// `uri` is supported as a param for backwards compatibility with anything
// that already navigates here with a pre-captured image; when omitted (the
// common path now) we launch the camera ourselves on mount.

export default function Capture() {
  const router = useRouter();
  const { colors } = useTheme();
  const { uri: paramUri } = useLocalSearchParams<{ uri?: string }>();
  // Guard against the effect re-running (e.g. from a re-render) and kicking
  // off a second camera launch / extraction for the same mount.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const uri = paramUri ?? (await captureFromCamera());
        // User backed out of the camera — return to the library.
        if (!uri) {
          router.back();
          return;
        }
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
        // Quota is derived from the number of saved highlights (see
        // getUsageCount), so there's nothing to increment here — the count
        // ticks up when /review actually saves.
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

// Returns the captured image URI, or null if the user canceled.
async function captureFromCamera(): Promise<string | null> {
  const picked = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.9,
    cameraType: ImagePicker.CameraType.back,
  });
  if (picked.canceled) return null;
  const uri = picked.assets?.[0]?.uri;
  if (!uri) throw new Error('No photo was returned by the camera.');
  return uri;
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
