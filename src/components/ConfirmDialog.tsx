import { Alert } from 'react-native';

export function confirm(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(opts.title, opts.message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: opts.confirmLabel ?? 'Confirm',
        style: opts.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true)
      }
    ]);
  });
}
