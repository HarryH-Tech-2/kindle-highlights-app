import { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { fonts } from '@/src/theme/colors';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// Smooth floating quote fragments for the onboarding background. Each
// fragment drifts diagonally on a long loop and gently pulses opacity at a
// different rate, so the field feels like a bookish scatter of epigraphs
// rather than a wall of decoration. Sizes, positions, durations, and
// quotes are randomised at mount so the field never looks like a grid.

// Short English literary fragments — mostly half-line aphorisms (3–10
// words) so each one reads as a single glance, with a few longer ones
// mixed in for variety. All English, no Latin, leaning into a
// contemplative reading-room mood.
const QUOTE_POOL = [
  'less is more',
  'know thyself',
  'be here now',
  'this too shall pass',
  'the only way out is through',
  'all shall be well',
  'attention is love',
  'the unexamined life is not worth living',
  'words are wind',
  'every moment is a fresh beginning',
  'the obstacle is the way',
  'do less, be more',
  'no mud, no lotus',
  'the present moment is enough',
  'small steps every day',
  'where attention goes, energy flows',
  'we read to know we are not alone',
  'a book is a dream you hold in your hand',
  'wherever you go, there you are',
  'between stimulus and response, there is space',
  'the journey is the reward',
  'simplicity is the ultimate sophistication',
  'still, I rise',
  'so it goes',
  'the universe is made of stories',
  'one page at a time',
  'in the middle of difficulty lies opportunity',
  'what you seek is seeking you',
];

// Space Grotesk light — ethereal, clean. Falls back to the system
// sans automatically if the font hasn't loaded yet (root layout blocks on
// font load, but defensive in case this component is rendered standalone).
const SERIF = fonts.serifItalic;

// Default vertical "safe band" — fractions of screen height that particles
// must avoid. Module-level constant so the default reference is stable
// across renders (otherwise useMemo below would re-create particles every
// render and they'd all jump back to their starting positions).
const DEFAULT_SAFE_BAND = { top: 0.32, bottom: 0.68 };

type ParticleSpec = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  size: number;
  duration: number;
  delay: number;
  baseOpacity: number;
  pulseDuration: number;
  quote: string;
};

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pickQuote(): string {
  return QUOTE_POOL[Math.floor(Math.random() * QUOTE_POOL.length)];
}

// Vertical "safe band" — fractions of screen height that particles must
// avoid. The onboarding text (emoji, title, body) sits in roughly the
// middle third of the screen, so we keep quotes in the top and bottom
// thirds where they decorate without overlapping copy.
type SafeBand = { top: number; bottom: number };

function makeParticles(
  count: number,
  width: number,
  height: number,
  safeBand: SafeBand
): ParticleSpec[] {
  const topMaxY = safeBand.top * height;
  const bottomMinY = safeBand.bottom * height;
  return Array.from({ length: count }, (_, i) => {
    // Alternate which band each particle lives in so we get roughly even
    // top/bottom coverage instead of clumping randomly.
    const inTopBand = i % 2 === 0;
    const yMin = inTopBand ? -20 : bottomMinY;
    const yMax = inTopBand ? topMaxY : height + 20;
    const startX = rand(-40, width + 40);
    const startY = rand(yMin, yMax);
    // Cap vertical drift so particles can't wander into the safe band
    // during their loop. Horizontal drift is unconstrained.
    const driftX = rand(-120, 120);
    const maxDriftY = Math.min(70, (yMax - yMin) * 0.3);
    const driftY = rand(-maxDriftY, maxDriftY);
    let endY = startY + driftY;
    if (endY < yMin) endY = yMin;
    if (endY > yMax) endY = yMax;
    return {
      startX,
      startY,
      endX: startX + driftX,
      endY,
      // Small, quiet typography — the longer English quotes still need to
      // fit on screen without wrapping into a paragraph, so we cap the
      // upper end. The lower end is small enough to read like a margin
      // annotation.
      size: rand(9, 14),
      duration: rand(6500, 11000),
      delay: rand(0, 4000),
      baseOpacity: rand(0.16, 0.36),
      pulseDuration: rand(1800, 3400),
      quote: pickQuote(),
    };
  });
}

export function ParticleBackground({
  // Fewer particles than the letter mode — each quote is wider, so we'd
  // collide too aggressively at the old count of 28.
  count = 16,
  color = '#6E63FF', // lumio violet
  // Default safe band keeps quotes out of the central ~36% of the screen
  // where the onboarding text card lives. Callers can tighten or widen
  // this for screens with differently-sized hero content.
  safeBand = DEFAULT_SAFE_BAND,
}: {
  count?: number;
  color?: string;
  safeBand?: SafeBand;
}) {
  // Use the screen dimensions at mount; we don't react to rotation since the
  // onboarding screen is portrait-locked anyway.
  const { width, height } = Dimensions.get('window');
  const particles = useMemo(
    () => makeParticles(count, width, height, safeBand),
    [count, width, height, safeBand]
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <Particle key={i} spec={p} color={color} />
      ))}
    </View>
  );
}

function Particle({ spec, color }: { spec: ParticleSpec; color: string }) {
  const progress = useSharedValue(0);
  const pulse = useSharedValue(spec.baseOpacity);

  useEffect(() => {
    progress.value = withDelay(
      spec.delay,
      withRepeat(
        withTiming(1, { duration: spec.duration, easing: Easing.inOut(Easing.sin) }),
        -1,
        true // reverse on each iteration → smooth back-and-forth drift
      )
    );
    pulse.value = withRepeat(
      withTiming(spec.baseOpacity * 1.6, {
        duration: spec.pulseDuration,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true
    );
    return () => {
      cancelAnimation(progress);
      cancelAnimation(pulse);
    };
  }, [progress, pulse, spec]);

  const style = useAnimatedStyle(() => {
    const x = spec.startX + (spec.endX - spec.startX) * progress.value;
    const y = spec.startY + (spec.endY - spec.startY) * progress.value;
    return {
      transform: [{ translateX: x }, { translateY: y }],
      opacity: pulse.value,
    };
  });

  return (
    <Animated.Text
      style={[
        {
          position: 'absolute',
          fontSize: spec.size,
          lineHeight: spec.size * 1.15,
          // Weight + italic are baked into the font family name itself, so
          // we don't add fontStyle/fontWeight here — that would make RN
          // hunt for a non-existent italic variant and could fall back
          // to the system default on Android.
          fontFamily: SERIF,
          color,
          // Subtle glow so quotes read as luminous rather than flat ink.
          textShadowColor: color,
          textShadowRadius: spec.size * 0.5,
          textShadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    >
      {spec.quote}
    </Animated.Text>
  );
}
