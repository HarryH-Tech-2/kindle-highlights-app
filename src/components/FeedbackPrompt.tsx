import { Modal, View, Text, Pressable, Linking, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/theme/ThemeContext';
import { fonts } from '@/src/theme/colors';

// Friendly one-time feedback ask. Shown right after the user creates their
// second highlight — at which point they've used the core flow enough to
// have an opinion, but not enough to be annoyed by the prompt.
//
// "Loving it" → Play Store review page for the app.
// "Could be better" → opens a pre-filled email to the support address.

const ANDROID_PACKAGE = 'com.harry.highlightcapture';
const REVIEW_URL_ANDROID = `market://details?id=${ANDROID_PACKAGE}`;
const REVIEW_URL_WEB = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
const SUPPORT_EMAIL = 'contact@harryh.tech';

export function FeedbackPrompt({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();

  const openReview = async () => {
    // market:// works on real devices with the Play Store app. We fall back
    // to the web URL on emulators or platforms without it.
    const url = Platform.OS === 'android' ? REVIEW_URL_ANDROID : REVIEW_URL_WEB;
    try {
      const supported = await Linking.canOpenURL(url);
      await Linking.openURL(supported ? url : REVIEW_URL_WEB);
    } catch {
      // Best effort — if both URLs fail there's nothing useful to fall back to.
    }
    onClose();
  };

  const openSupportEmail = async () => {
    const subject = encodeURIComponent('Highlight Capture — feedback');
    const body = encodeURIComponent(
      "Hi Harry,\n\nHere's how I think Highlight Capture could be better:\n\n"
    );
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    try {
      await Linking.openURL(mailto);
    } catch {
      // Ignore — user might not have a mail client configured.
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: colors.bg,
            borderRadius: 20,
            padding: 22,
            gap: 14,
          }}
        >
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: colors.primary + '22',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="heart" size={26} color={colors.primary} />
            </View>
            <Text
              style={{
                fontFamily: fonts.serif,
                fontSize: 22,
                fontWeight: '700',
                color: colors.text,
                textAlign: 'center',
                letterSpacing: -0.3,
              }}
            >
              How's it going so far?
            </Text>
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 14,
                lineHeight: 21,
                color: colors.textMuted,
                textAlign: 'center',
              }}
            >
              You've captured a couple of highlights — a quick thumbs up or
              tip would really help shape the app.
            </Text>
          </View>

          <View style={{ gap: 10, marginTop: 6 }}>
            <Pressable
              onPress={openReview}
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                paddingVertical: 14,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Ionicons name="star" size={17} color={colors.primaryText} />
              <Text
                style={{
                  color: colors.primaryText,
                  fontWeight: '700',
                  fontSize: 15,
                  letterSpacing: 0.3,
                }}
              >
                I'm loving it
              </Text>
            </Pressable>

            <Pressable
              onPress={openSupportEmail}
              style={({ pressed }) => ({
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 14,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="mail" size={17} color={colors.text} />
              <Text
                style={{
                  color: colors.text,
                  fontWeight: '600',
                  fontSize: 15,
                }}
              >
                Could be better
              </Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                paddingVertical: 10,
                alignItems: 'center',
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
                Maybe later
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
