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
import { useRouter } from 'expo-router';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
} from '@/src/auth/firebase';
import { useTheme } from '@/src/theme/ThemeContext';
import { darkColors } from '@/src/theme/colors';

// Login wall shown to signed-out users (routed here by app/_layout.tsx).
// Supports Google sign-in plus email/password sign-in and account creation;
// the latter is toggled inline so we don't burn an extra route for it.

type Mode = 'signin' | 'signup';

// Map Firebase auth error codes into messages we'd actually show a human.
// Anything we don't recognise falls back to the raw message so we don't
// swallow useful debugging info during beta.
function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const message = (e as { message?: string })?.message ?? 'Something went wrong.';
  switch (code) {
    case 'auth/invalid-email':
      return "That doesn't look like a valid email address.";
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Please use a password with at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return message;
  }
}

export default function LoginScreen() {
  const { colors: _themeColors } = useTheme();
  // Login always uses the midnight background for brand consistency.
  const colors = darkColors;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<null | 'google' | 'email'>(null);
  const [showPassword, setShowPassword] = useState(false);

  const isSignup = mode === 'signup';

  const handleGoogleSignIn = async () => {
    if (busy) return;
    setBusy('google');
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) router.replace('/');
    } catch (e: unknown) {
      Alert.alert('Sign-in failed', authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const handleForgotPassword = () => {
    if (busy) return;
    // Hand off to a dedicated screen so the user isn't staring at their
    // password field while recovering. We pass the email already typed (if
    // any) so they don't have to retype it.
    router.push({
      pathname: '/forgot-password',
      params: email.trim() ? { email: email.trim() } : {},
    });
  };

  const handleEmailSubmit = async () => {
    if (busy) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Missing details', 'Please enter your email and password.');
      return;
    }
    if (isSignup && password.length < 6) {
      Alert.alert('Weak password', 'Please use at least 6 characters.');
      return;
    }
    setBusy('email');
    try {
      const signedIn = isSignup
        ? await signUpWithEmail(trimmedEmail, password, name.trim() || undefined)
        : await signInWithEmail(trimmedEmail, password);
      if (signedIn) router.replace('/');
    } catch (e: unknown) {
      Alert.alert(
        isSignup ? 'Sign-up failed' : 'Sign-in failed',
        authErrorMessage(e)
      );
    } finally {
      setBusy(null);
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
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 32,
            paddingVertical: 24,
            justifyContent: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero mark — the actual app icon so the login screen reads as
              "this app", not a generic placeholder. Rendered at 88px with
              rounded corners to match the launcher icon shape. */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Image
              source={require('../assets/images/app-icon.png')}
              style={{
                width: 110,
                height: 110,
                borderRadius: 24,
                marginBottom: 20,
              }}
              resizeMode="contain"
            />
            <Text
              style={{
                fontSize: 26,
                fontWeight: '700',
                color: colors.text,
                textAlign: 'center',
                letterSpacing: -0.5,
              }}
            >
              {isSignup ? 'Create your account' : 'Welcome'}
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: colors.textMuted,
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 21,
              }}
            >
              {isSignup
                ? 'Sync your ideas across devices.'
                : 'Sign in to access your library.'}
            </Text>
          </View>

          {/* Email form */}
          <View style={{ gap: 10 }}>
            {isSignup && (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name (optional)"
                placeholderTextColor={colors.textSubtle}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!busy}
                style={inputStyle}
              />
            )}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.textSubtle}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!busy}
              style={inputStyle}
            />
            {/* Password field with show/hide toggle. The eye icon sits
                inside the input via absolute positioning; we add right
                padding to the input so the text never collides with it. */}
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={isSignup ? 'Password (6+ characters)' : 'Password'}
                placeholderTextColor={colors.textSubtle}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={isSignup ? 'password-new' : 'password'}
                editable={!busy}
                style={[inputStyle, { paddingRight: 44 }]}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                disabled={!!busy}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                style={({ pressed }) => ({
                  position: 'absolute',
                  right: 10,
                  padding: 6,
                  opacity: busy ? 0.4 : pressed ? 0.5 : 1,
                })}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <Pressable
              onPress={handleEmailSubmit}
              disabled={!!busy}
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
              {busy === 'email' ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text
                  style={{ color: colors.primaryText, fontSize: 16, fontWeight: '600' }}
                >
                  {isSignup ? 'Create account' : 'Sign in'}
                </Text>
              )}
            </Pressable>

            {/* Password recovery — only meaningful on sign-in (sign-up
                doesn't have a password to recover yet). Sends a reset
                link via Firebase Auth using the email already typed. */}
            {!isSignup && (
              <Pressable
                onPress={handleForgotPassword}
                disabled={!!busy}
                hitSlop={8}
                style={({ pressed }) => ({
                  alignSelf: 'center',
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  opacity: busy ? 0.4 : pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                  Forgot password?
                </Text>
              </Pressable>
            )}
          </View>

          {/* Toggle between sign-in and sign-up */}
          <Pressable
            onPress={() => {
              if (busy) return;
              setMode(isSignup ? 'signin' : 'signup');
            }}
            style={({ pressed }) => ({
              paddingVertical: 14,
              alignItems: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              {isSignup ? (
                <>
                  Already have an account?{' '}
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>
                    Sign in
                  </Text>
                </>
              ) : (
                <>
                  New here?{' '}
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>
                    Create an account
                  </Text>
                </>
              )}
            </Text>
          </Pressable>

          {/* Divider */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginVertical: 8,
              gap: 12,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.textSubtle, fontSize: 12, fontWeight: '600' }}>
              OR
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          {/* Google CTA */}
          <Pressable
            onPress={handleGoogleSignIn}
            disabled={!!busy}
            style={({ pressed }) => ({
              backgroundColor: colors.text,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.6 : pressed ? 0.9 : 1,
              gap: 12,
            })}
          >
            {busy === 'google' ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.bg} />
                <Text style={{ color: colors.bg, fontSize: 15, fontWeight: '600' }}>
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
              marginTop: 20,
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
