import { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { recognizeFromUri } from '@/src/ocr/recognize';

export default function Capture() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [busy, setBusy] = useState(false);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text style={{ textAlign: 'center' }}>
          Camera access is needed to capture highlights.
        </Text>
        <Pressable
          onPress={async () => {
            const r = await requestPermission();
            if (!r.granted) Linking.openSettings();
          }}
          style={{ padding: 12, backgroundColor: '#007aff', borderRadius: 8 }}
        >
          <Text style={{ color: '#fff' }}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  const handleSnap = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: true });
      if (!photo?.uri) throw new Error('No photo URI');
      const text = await recognizeFromUri(photo.uri);
      // Discard the photo immediately
      try { await FileSystem.deleteAsync(photo.uri, { idempotent: true }); } catch {}

      if (!text) {
        Alert.alert('No text detected', 'Try again, or enter the highlight manually.', [
          { text: 'Retry', style: 'cancel' },
          { text: 'Enter manually', onPress: () => router.replace({ pathname: '/review', params: { text: '' } }) }
        ]);
        return;
      }
      router.replace({ pathname: '/review', params: { text } });
    } catch (e: any) {
      Alert.alert('Capture failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      <View style={{ position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center' }}>
        {busy ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <Pressable
            onPress={handleSnap}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#fff',
              borderWidth: 4,
              borderColor: '#ccc'
            }}
          />
        )}
      </View>
    </View>
  );
}
