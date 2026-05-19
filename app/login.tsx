import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { signInWithGoogle } from '@/src/auth/firebase';
import { useTheme } from '@/src/theme/ThemeContext';

// Login wall shown to signed-out users (routed here by app/_layout.tsx).
// The signed-in account dashboard used to live alongside this UI under
// /account; that screen has been folded into the Settings tab, so this
// route is login-only.
export default function LoginScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) router.replace('/');
    } catch (e: unknown) {
      Alert.alert('Sign-in failed', (e as Error)?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, paddingHorizontal: 32, justifyContent: 'center' }}>
        {/* Hero mark */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              shadowColor: colors.primary,
              shadowOpacity: 0.3,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 8,
            }}
          >
            <Ionicons name="book" size={48} color={colors.primaryText} />
          </View>
          <Text
            style={{
              fontSize: 30,
              fontWeight: '700',
              color: colors.text,
              textAlign: 'center',
              letterSpacing: -0.5,
            }}
          >
            Highlight Capture for Books
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: colors.textMuted,
              textAlign: 'center',
              marginTop: 8,
              lineHeight: 22,
            }}
          >
            Capture, organize, and revisit every passage you care about.
          </Text>
        </View>

        {/* Primary CTA */}
        <Pressable
          onPress={handleSignIn}
          disabled={busy}
          style={({ pressed }) => ({
            backgroundColor: colors.text,
            borderRadius: 14,
            paddingVertical: 16,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy ? 0.6 : pressed ? 0.9 : 1,
            gap: 12,
          })}
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={colors.bg} />
              <Text style={{ color: colors.bg, fontSize: 16, fontWeight: '600' }}>
                Continue with Google
              </Text>
            </>
          )}
        </Pressable>

        <Text
          style={{
            fontSize: 12,
            color: colors.textSubtle,
            textAlign: 'center',
            marginTop: 24,
            lineHeight: 18,
          }}
        >
          By continuing you agree to our{' '}
          <Text
            onPress={() => router.push('/privacy')}
            style={{ color: colors.primary, fontWeight: '600' }}
          >
            Terms & Privacy Policy
          </Text>
          .
        </Text>
      </View>
    </SafeAreaView>
  );
}
