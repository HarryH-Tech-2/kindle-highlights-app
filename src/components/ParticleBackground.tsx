import { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// Smooth light-blue floating particles for the onboarding background.
// Each particle drifts diagonally on a long loop and gently pulses opacity
// at a different rate. Sizes/positions/durations are randomised at mount
// so the field doesn't look like a grid.

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
};

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function makeParticles(count: number, width: number, height: number): ParticleSpec[] {
  return Array.from({ length: count }, () => {
    const startX = rand(-40, width + 40);
    const startY = rand(-40, height + 40);
    // Drift target somewhere offset from the start so motion is visible but slow.
    const driftX = rand(-120, 120);
    const driftY = rand(-160, 160);
    return {
      startX,
      startY,
      endX: startX + driftX,
      endY: startY + driftY,
      size: rand(6, 18),
      duration: rand(9000, 16000),
      delay: rand(0, 4000),
      baseOpacity: rand(0.18, 0.45),
      pulseDuration: rand(2200, 4200),
    };
  });
}

export function ParticleBackground({ count = 18 }: { count?: number }) {
  // Use the screen dimensions at mount; we don't react to rotation since the
  // onboarding screen is portrait-locked anyway.
  const { width, height } = Dimensions.get('window');
  const particles = useMemo(() => makeParticles(count, width, height), [count, width, height]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <Particle key={i} spec={p} />
      ))}
    </View>
  );
}

function Particle({ spec }: { spec: ParticleSpec }) {
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
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size / 2,
          backgroundColor: '#7FB8FF', // light blue
          // Soft glow so particles read as luminous rather than solid dots.
          shadowColor: '#7FB8FF',
          shadowOpacity: 0.9,
          shadowRadius: spec.size,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    />
  );
}
