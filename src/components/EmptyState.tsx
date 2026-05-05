import { View, Text } from 'react-native';

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ textAlign: 'center', color: '#666' }}>{message}</Text>
    </View>
  );
}
