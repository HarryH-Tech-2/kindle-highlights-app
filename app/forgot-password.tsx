import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { sendPasswordReset } from '@/src/auth/firebase';
import { useTheme } from '@/src/theme/ThemeContext';
import { darkColors } from '@/src/theme/colors';

// Standalone password-recovery screen. We don't reuse the login screen for
// this because we don't want the user to see a password field at all while
// they're explicitly recovering — that's the whole point of the flow.
//
// The previous email (if any) is passed in via the `email` query param so
// the user doesn't have to retype it after tapping "Forgot password?" on
// the sign-in screen.

function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const message = (e as { message?: string })?.message ?? 'Something went wrong.';
  switch (code) {
    case 'auth/invalid-email':
      return "That doesn't look like a valid email address.";
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return message;
  }
}

export default function ForgotPasswordScreen() {
  const { colors: _themeColors } = useTheme();
  // Match the midnight login background.
  const colors = darkColors;
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [busy, setBusy] = useState(false);
  // Once we've fired the reset email, swap the form for a confirmation
  // panel so the user gets visual closure rather than just an Alert that
  // they have to dismiss.
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSend = async () => {
    if (busy) return;
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Enter your email', 'Please type the email address for your account.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert('Invalid email', "That doesn't look like a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(trimmed);
      setSentTo(trimmed);
    } catch (e: unknown) {
      // Generic confirmation either way so we don't leak account existence
      // via the reset endpoint (Firebase exposes auth/user-not-found when
      // email enumeration protection is off).
      const code = (e as { code?: string })?.code ?? '';
      if (code === 'auth/user-not-found') {
        setSentTo(trimmed);
      } else {
        Alert.alert('Reset failed', authErrorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15,
    color: colors.text,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top bar with a back chevron so the user has a clear way back to
            the sign-in screen even if they reach this view via a deep
            link rather than the login flow. */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => ({
              padding: 8,
              borderRadius: 8,
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 32,
            paddingBottom: 24,
            justifyContent: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero mark — same app icon as login so this screen reads as
              part of the same flow. */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <Image
              source={require('../assets/images/app-icon.png')}
              style={{ width: 92, height: 92, borderRadius: 22, marginBottom: 16 }}
              resizeMode="contain"
            />
            <Text
              style={{
                fontSize: 24,
                fontWeight: '700',
                color: colors.text,
                textAlign: 'center',
                letterSpacing: -0.4,
              }}
            >
              {sentTo ? 'Check your email' : 'Reset your password'}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                textAlign: 'center',
                marginTop: 8,
                lineHeight: 21,
              }}
            >
              {sentTo
                ? `If an account exists for ${sentTo}, we've sent a link to reset your password. The link expires in about an hour.`
                : "Enter the email address you used to sign up and we'll send you a link to reset your password."}
            </Text>
          </View>

          {sentTo ? (
            // Confirmation state — give the user two clear next steps:
            // jump back to sign-in (most common after a successful reset),
            // or resend if the email never arrives.
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() => router.replace('/login')}
                style={({ pressed }) => ({
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text
                  style={{ color: colors.primaryText, fontSize: 16, fontWeight: '600' }}
                >
                  Back to sign in
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSentTo(null)}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  alignItems: 'center',
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  Didn't get it? Try a different email
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.textSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                autoFocus={!params.email}
                editable={!busy}
                onSubmitEditing={onSend}
                returnKeyType="send"
                style={inputStyle}
              />
              <Pressable
                onPress={onSend}
                disabled={busy}
                style={({ pressed }) => ({
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  paddingVertical: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 4,
                  gap: 8,
                  opacity: busy ? 0.6 : pressed ? 0.9 : 1,
                })}
              >
                {busy ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Text
                    style={{ color: colors.primaryText, fontSize: 16, fontWeight: '600' }}
                  >
                    Send reset link
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => router.back()}
                disabled={busy}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  alignItems: 'center',
                  opacity: busy ? 0.4 : pressed ? 0.5 : 1,
                })}
              >
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  Back to sign in
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
