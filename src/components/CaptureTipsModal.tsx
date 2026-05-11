import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/theme/ThemeContext';

// First-time tips modal shown before the camera launches. The "Don't show
// again" preference is owned by the parent — this component just reports
// the checkbox state when the user dismisses the modal.

type Props = {
  visible: boolean;
  onAcknowledge: (dontShowAgain: boolean) => void;
};

const TIPS = [
  'Use clear, even lighting — avoid shadows across the Kindle screen.',
  'Hold the camera steady and parallel to the screen to avoid distortion.',
  'Make sure the highlighted passage is fully visible and in focus.',
  'Watch for glare from windows or overhead lights on the e-ink surface.',
];

export function CaptureTipsModal({ visible, onAcknowledge }: Props) {
  const { colors } = useTheme();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // System back gesture should dismiss without persisting the preference.
      onRequestClose={() => onAcknowledge(false)}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 24,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="bulb-outline" size={22} color={colors.primary} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>
              For the best photo
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            {TIPS.map((tip) => (
              <View key={tip} style={{ flexDirection: 'row', gap: 10 }}>
                <Text style={{ color: colors.primary, fontSize: 15, lineHeight: 22 }}>•</Text>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    lineHeight: 22,
                    color: colors.textMuted,
                  }}
                >
                  {tip}
                </Text>
              </View>
            ))}
          </View>

          {/* Checkbox row */}
          <Pressable
            onPress={() => setDontShowAgain((v) => !v)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 8,
              opacity: pressed ? 0.7 : 1,
            })}
            hitSlop={8}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                borderWidth: 2,
                borderColor: dontShowAgain ? colors.primary : colors.border,
                backgroundColor: dontShowAgain ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {dontShowAgain && (
                <Ionicons name="checkmark" size={16} color={colors.primaryText} />
              )}
            </View>
            <Text style={{ color: colors.text, fontSize: 15 }}>Don't show this again</Text>
          </Pressable>

          <Pressable
            onPress={() => onAcknowledge(dontShowAgain)}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              padding: 14,
              borderRadius: 12,
              alignItems: 'center',
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: colors.primaryText, fontSize: 16, fontWeight: '600' }}>
              Got it
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
