// Renders the current theme's ambient background — a low-opacity texture
// image with a heavily-tinted colour overlay so the original `bgSolid`
// colour still dominates and screens remain legible. Sits absolutely
// positioned behind the rest of the app inside `_layout.tsx`.
//
// Screens use `backgroundColor: colors.bg` (which is 'transparent' for any
// theme with a `bgImage`), so this layer shows through automatically. Use
// `colors.bgSolid` if you need an opaque surface that hides the texture.

import { Image, View } from 'react-native';
import { useTheme } from './ThemeContext';

export function BackgroundLayer() {
  const { colors } = useTheme();
  // Always paint the solid colour first so things look correct even when
  // the texture asset is still loading or missing.
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.bgSolid,
      }}
    >
      {colors.bgImage && (
        <>
          <Image
            source={colors.bgImage}
            resizeMode="cover"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: colors.bgImageOpacity,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.bgImageTint,
            }}
          />
        </>
      )}
    </View>
  );
}
