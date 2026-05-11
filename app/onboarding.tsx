import { useState } from 'react';
import { View, Text, Pressable, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { getDb } from '@/src/db/client';
import { markOnboardingSeen } from '@/src/db/meta';
import { useTheme } from '@/src/theme/ThemeContext';
import { ParticleBackground } from '@/src/components/ParticleBackground';

type Step = {
  emoji: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    emoji: '📖',
    title: 'Capture highlights from your Kindle',
    body:
      'Snap a photo of any highlighted passage on your Kindle screen and the app will pull the exact text out for you — no typing required.',
  },
  {
    emoji: '💡',
    title: 'Good photos give the best results',
    body:
      'For the most reliable extraction, take the photo in clear, even lighting and try to avoid glare or motion blur. The app still works in trickier conditions — it will just have an easier time when the highlight is easy to read.',
  },
  {
    emoji: '🗂️',
    title: 'Organise and export',
    body:
      'Every highlight is saved against the book it came from. Add tags, write a note, and export your collection to plain text whenever you want.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  // After onboarding we always go through /account — the root layout's auth
  // gate handles forwarding signed-in users on to the library.
  const finish = async () => {
    const db = await getDb();
    await markOnboardingSeen(db);
    router.replace('/account');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ParticleBackground />
      <View style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 32 }}>
          {!isLast && (
            <Pressable onPress={finish} hitSlop={12}>
              <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: '500' }}>
                Skip
              </Text>
            </Pressable>
          )}
        </View>

        <View style={{ alignItems: 'center', gap: 16, paddingHorizontal: 8 }}>
          <Text style={{ fontSize: 64 }}>{step.emoji}</Text>
          <Text
            style={{
              fontSize: 26,
              fontWeight: '700',
              textAlign: 'center',
              color: colors.text,
              letterSpacing: -0.3,
            }}
          >
            {step.title}
          </Text>
          <Text
            style={{
              fontSize: 16,
              lineHeight: 23,
              textAlign: 'center',
              color: colors.textMuted,
            }}
          >
            {step.body}
          </Text>
        </View>

        <View style={{ gap: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === index ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === index ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>

          <Pressable
            onPress={() => (isLast ? finish() : setIndex(index + 1))}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              padding: 16,
              borderRadius: 14,
              alignItems: 'center',
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: colors.primaryText, fontSize: 16, fontWeight: '600' }}>
              {isLast ? 'Get started' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
