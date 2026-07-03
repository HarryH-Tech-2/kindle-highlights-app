import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, PanResponder, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { getDb } from '@/src/db/client';
import { markOnboardingSeen } from '@/src/db/meta';
import { getCurrentUser } from '@/src/auth/firebase';
import { useTheme } from '@/src/theme/ThemeContext';
import { darkColors } from '@/src/theme/colors';
import { ParticleBackground } from '@/src/components/ParticleBackground';

// Slide animation duration — short enough that taps feel responsive but
// long enough that the motion still reads. 220ms with an ease-out cubic
// settles in roughly one perceived "beat".
const SLIDE_DURATION_MS = 220;

type Step = {
  emoji: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    emoji: '📖',
    title: 'Capture ideas from any book',
    body:
      'Snap a photo of any highlighted passage — Kindle, paper book, PDF, or any app — and Lumio extracts the text instantly. No typing required.',
  },
  {
    emoji: '💡',
    title: 'Good photos, better results',
    body:
      'For the most reliable extraction, use clear, even lighting and avoid glare or motion blur. Colored highlights on paper or screen work even better than subtle e-ink highlights.',
  },
  {
    emoji: '🗂️',
    title: 'Remember what shapes you',
    body:
      'Every idea is saved against the book it came from. Add tags, write a note, and turn your reading into lasting, searchable knowledge.',
  },
];

// Midnight background matching the Lumio brand — dark with violet glow
// from the particle system, matching the PDF brand pages.
const BG = '#0B0B0F';

export default function Onboarding() {
  const router = useRouter();
  const { colors: _themeColors } = useTheme();
  // Onboarding always uses midnight background, so force dark palette
  // regardless of the user's theme preference.
  const colors = darkColors;
  const [index, setIndex] = useState(0);
  const isFirst = index === 0;
  const isLast = index === STEPS.length - 1;

  // We snapshot the screen width once and slide a row of all three step
  // panels horizontally inside an overflow-hidden container. The width has
  // to match what each panel actually takes on screen, so we use the raw
  // window width and let each panel pad its own content.
  const { width } = Dimensions.get('window');
  const translateX = useSharedValue(0);

  // PanResponder callbacks are created once and need to see the *current*
  // index/translation on every gesture. Refs keep us out of stale-closure
  // hell without recreating the responder on every render.
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  const gestureStartXRef = useRef(0);
  // We acquire the responder via `onMoveShouldSetPanResponder`, which means
  // by the time `onPanResponderGrant` fires the gesture's `dx` is already
  // non-zero (the threshold movement that triggered acquisition). We snap
  // that offset off so the first `onPanResponderMove` doesn't cause a
  // visible jump of ~6px from the rest position.
  const gestureStartDxRef = useRef(0);

  useEffect(() => {
    translateX.value = withTiming(-index * width, {
      duration: SLIDE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [index, width, translateX]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const goNext = useCallback(() => setIndex((i) => Math.min(i + 1, STEPS.length - 1)), []);
  const goBack = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  // Horizontal swipe — drag the slide track with the finger and snap to the
  // next/previous step on release based on travel + velocity. We only claim
  // the gesture when the motion is meaningfully horizontal, so vertical
  // scrolls on the body text don't get hijacked.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderGrant: (_, g) => {
          // Kill any in-flight slide animation before we anchor — otherwise
          // the next `translateX.value = ...` assignment in Move would race
          // a still-running withTiming and the panel can flicker.
          cancelAnimation(translateX);
          gestureStartXRef.current = translateX.value;
          gestureStartDxRef.current = g.dx;
        },
        onPanResponderMove: (_, g) => {
          // Use *incremental* movement since grant, not raw g.dx, so the
          // page doesn't jump by the acquisition threshold on the first
          // move event.
          const dx = g.dx - gestureStartDxRef.current;
          // Rubber-band at the edges so dragging past the first/last step
          // resists rather than just sliding off the page.
          const min = -(STEPS.length - 1) * width;
          const max = 0;
          let next = gestureStartXRef.current + dx;
          if (next > max) next = max + (next - max) * 0.3;
          if (next < min) next = min + (next - min) * 0.3;
          translateX.value = next;
        },
        onPanResponderRelease: (_, g) => {
          const i = indexRef.current;
          // Either travel a quarter of a screen or flick fast enough to
          // count as an intentional swipe. Distance is measured from the
          // grant offset so the threshold doesn't include the few pixels
          // we discarded above.
          const distance = g.dx - gestureStartDxRef.current;
          const velocity = g.vx;
          const distanceTrip = width * 0.22;
          const velocityTrip = 0.35;
          let target = i;
          if (distance < -distanceTrip || velocity < -velocityTrip) {
            target = Math.min(i + 1, STEPS.length - 1);
          } else if (distance > distanceTrip || velocity > velocityTrip) {
            target = Math.max(i - 1, 0);
          }
          if (target !== i) {
            setIndex(target);
          } else {
            // Snap back to the current step from wherever the finger left
            // off — the useEffect above won't fire because index didn't
            // change, so we animate manually.
            translateX.value = withTiming(-i * width, {
              duration: SLIDE_DURATION_MS,
              easing: Easing.out(Easing.cubic),
            });
          }
        },
        onPanResponderTerminate: () => {
          translateX.value = withTiming(-indexRef.current * width, {
            duration: SLIDE_DURATION_MS,
            easing: Easing.out(Easing.cubic),
          });
        },
      }),
    [translateX, width]
  );

  // After onboarding we route to /login for signed-out users so they hit the
  // login wall, or straight back to the library for signed-in users (which
  // is what happens when a dev replays the flow from the Settings menu).
  // The DB write is intentionally fire-and-forget so the screen transition
  // happens immediately on tap — SQLite is local and the write completes
  // well before the user could trigger another onboarding redirect.
  const finish = useCallback(() => {
    let signedIn = false;
    try {
      signedIn = !!getCurrentUser();
    } catch {
      // Native auth module unavailable — treat as signed-out.
    }
    router.replace(signedIn ? '/' : '/login');
    (async () => {
      try {
        const db = await getDb();
        await markOnboardingSeen(db);
      } catch {
        // Persistence is best-effort; routing has already happened. On the
        // off chance the write fails, the user just sees onboarding once
        // more on next launch — not worth blocking the transition for.
      }
    })();
  }, [router]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: BG }}>
      <ParticleBackground />

      {/* Top bar — Skip only. Back has moved to the bottom row next to the
          primary CTA so the two navigation actions sit together. Skip is
          always rendered (just hidden on the last step) so the bar's height
          stays fixed and nothing else on the page shifts when the user
          reaches the final step. */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: 16,
          paddingTop: 32,
          minHeight: 44,
        }}
      >
        <Pressable
          onPress={finish}
          hitSlop={12}
          disabled={isLast}
          style={({ pressed }) => ({
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderRadius: 8,
            opacity: isLast ? 0 : pressed ? 0.5 : 1,
          })}
        >
          <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: '500' }}>
            Skip
          </Text>
        </Pressable>
      </View>

      {/* Slide track — all three panels rendered side by side, translated
          horizontally as `index` changes. Container clips overflow so only
          the active panel is visible at any time. PanResponder is attached
          here so any touch over the panel area can initiate a swipe. */}
      <View style={{ flex: 1, overflow: 'hidden' }} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            {
              flex: 1,
              flexDirection: 'row',
              width: width * STEPS.length,
            },
            slideStyle,
          ]}
        >
          {STEPS.map((step, i) => (
            <View
              key={i}
              style={{
                width,
                flex: 1,
                paddingHorizontal: 32,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
              }}
            >
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
          ))}
        </Animated.View>
      </View>

      {/* Bottom chrome — page indicator + [Back] + primary CTA in one row.
          Back is a square outline button that only appears after step 1;
          when hidden, the primary CTA stretches across the full width. */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32, gap: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          {STEPS.map((_, i) => (
            <PageDot key={i} active={i === index} colors={colors} />
          ))}
        </View>

        {/* On the first step there's no Back to pair with, so we center
            the primary CTA on its own at the same width it would have in
            the two-button row. From step 2 onward, Back + primary CTA
            share identical sizing (both flex: 1, same padding) so they
            read as a paired control. */}
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            justifyContent: isFirst ? 'center' : 'flex-start',
          }}
        >
          {!isFirst && (
            <Pressable
              onPress={goBack}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 16,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                Back
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={isLast ? finish : goNext}
            // Stronger pressed-opacity and a subtle press-down scale make
            // the tap feel immediate even before the slide animation kicks in.
            style={({ pressed }) => ({
              flex: isFirst ? undefined : 1,
              width: isFirst ? '60%' : undefined,
              backgroundColor: colors.primary,
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
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

// Animated pill that smoothly grows when active and shrinks when inactive,
// so the indicator transition matches the panel slide instead of snapping.
function PageDot({
  active,
  colors,
}: {
  active: boolean;
  colors: { primary: string; border: string };
}) {
  const w = useSharedValue(active ? 24 : 8);

  useEffect(() => {
    w.value = withTiming(active ? 24 : 8, {
      duration: SLIDE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, w]);

  const style = useAnimatedStyle(() => ({ width: w.value }));

  return (
    <Animated.View
      style={[
        {
          height: 8,
          borderRadius: 4,
          backgroundColor: active ? colors.primary : colors.border,
        },
        style,
      ]}
    />
  );
}
