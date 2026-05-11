import { View, Text } from 'react-native';
import { useTheme } from '@/src/theme/ThemeContext';

export function EmptyState({ message }: { message: string }) {
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
      <Text style={{ textAlign: 'center', color: colors.textMuted, fontSize: 15, lineHeight: 22 }}>
        {message}
      </Text>
    </View>
  );
}
