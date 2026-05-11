import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from '@/src/db/client';
import { setSubscribed } from '@/src/db/meta';
import {
  getMonthlySubscription,
  purchaseMonthly,
  restorePurchases,
  type SubscriptionOffer,
} from '@/src/billing';
import { useTheme } from '@/src/theme/ThemeContext';

// Benefits to surface on the paywall. Kept short and scannable — each line
// should be a concrete value, not marketing fluff.
const BENEFITS: Array<{
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
}> = [
  {
    icon: 'infinite',
    title: 'Unlimited highlights',
    body: 'Capture as many Kindle passages as you want — no monthly cap.',
  },
  {
    icon: 'cloud-upload',
    title: 'Cloud sync across devices',
    body: 'Your library stays in sync between every device you sign in on.',
  },
  {
    icon: 'color-palette',
    title: 'Styled highlights',
    body: 'Colour and italicise saved highlights to make them yours.',
  },
  {
    icon: 'document-text',
    title: 'Full library export',
    body: 'Export every highlight, book, or tag to clean Markdown.',
  },
  {
    icon: 'heart',
    title: 'Support a solo developer',
    body: 'Help keep the app maintained and ad-free.',
  },
];

export default function Paywall() {
  const router = useRouter();
  const { colors } = useTheme();
  const [offer, setOffer] = useState<SubscriptionOffer | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const o = await getMonthlySubscription();
        setOffer(o);
      } catch (e: any) {
        // Don't block the UI — the user can still see the paywall and Restore button.
        console.warn('[paywall] could not load subscription:', e?.message);
      } finally {
        setLoadingOffer(false);
      }
    })();
  }, []);

  const onSubscribe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await purchaseMonthly();
      if (ok) {
        await setSubscribed(await getDb(), true);
        Alert.alert('Subscribed', 'Thanks for supporting the app!');
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Purchase failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const active = await restorePurchases();
      await setSubscribed(await getDb(), active);
      if (active) {
        Alert.alert('Restored', 'Your subscription is active again.');
        router.back();
      } else {
        Alert.alert('No subscription found', 'We could not find an active subscription on this account.');
      }
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 24, gap: 24 }}
    >
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 }}>
          Go Pro
        </Text>
        <Text style={{ fontSize: 16, lineHeight: 22, color: colors.textMuted }}>
          Unlock unlimited highlights and the full toolkit for capturing your reading.
        </Text>
      </View>

      <View style={{ gap: 14 }}>
        {BENEFITS.map((b) => (
          <View key={b.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.primary + '22',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={b.icon} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                {b.title}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textMuted, marginTop: 2 }}>
                {b.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          padding: 16,
          gap: 6,
          backgroundColor: colors.surface,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>
          Kindle Highlights Pro
        </Text>
        <Text style={{ fontSize: 14, color: colors.textMuted }}>
          Billed monthly. Cancel any time.
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 4, color: colors.text }}>
          {loadingOffer ? 'Loading…' : offer?.priceLabel ?? '$2.00 / month'}
        </Text>
      </View>

      <Pressable
        onPress={onSubscribe}
        disabled={busy}
        style={{
          backgroundColor: colors.primary,
          padding: 16,
          borderRadius: 12,
          alignItems: 'center',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={{ color: colors.primaryText, fontSize: 16, fontWeight: '600' }}>
            Subscribe
          </Text>
        )}
      </Pressable>

      <Pressable onPress={onRestore} disabled={busy} style={{ alignItems: 'center', padding: 8 }}>
        <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '500' }}>
          Restore purchases
        </Text>
      </Pressable>

      <Text style={{ fontSize: 12, color: colors.textSubtle, textAlign: 'center', lineHeight: 18 }}>
        Subscriptions auto-renew until cancelled. You can manage or cancel any time in the Google
        Play Store.
      </Text>
    </ScrollView>
  );
}
