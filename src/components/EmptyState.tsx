import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/theme/ThemeContext';
import { fonts } from '@/src/theme/colors';

export function EmptyState({
  message,
  title,
  icon = 'bookmark-outline',
}: {
  message: string;
  title?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        minHeight: 240,
      }}
    >
      {/* Tinted circle holding the icon — gives the screen a focal point
          instead of a wall of muted text. */}
      <View
        style={{
          width: 68,
          height: 68,
          borderRadius: 999,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
        }}
      >
        <Ionicons name={icon} size={28} color={colors.textMuted} />
      </View>
      {title && (
        <Text
          style={{
            fontFamily: fonts.serif,
            fontSize: 19,
            color: colors.text,
            marginBottom: 6,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
      )}
      <Text
        style={{
          fontFamily: fonts.sans,
          textAlign: 'center',
          color: colors.textMuted,
          fontSize: 14,
          lineHeight: 22,
          maxWidth: 280,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
