import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/theme/ThemeContext';

// Plain-English privacy & terms page. Static in-app copy (rather than a
// webview) so it works offline and renders in the user's theme. If the
// legal text ever needs versioning, move it to a remote markdown file and
// render it here.

type Section = { icon: IconName; heading: string; body: string };
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const CONTACT_EMAIL = 'contact@harryh.tech';
const LAST_UPDATED = 'May 2026';

const PRIVACY: Section[] = [
  {
    icon: 'phone-portrait-outline',
    heading: 'Data stored on your device',
    body:
      'Your books, highlights, notes, and tags are saved in a local SQLite database on your device. You can export this data as Markdown at any time from Settings, and remove it entirely by uninstalling the app or clearing its storage.',
  },
  {
    icon: 'camera-outline',
    heading: 'Camera & photos',
    body:
      'The camera is used only when you tap the capture button. The photo you take is held in temporary storage just long enough to extract the highlighted text, then deleted automatically — it is never written to your photo library and never persisted by us. Photo-library access is requested only if you choose to save a beautified quote card.',
  },
  {
    icon: 'cloud-outline',
    heading: 'Text extraction (Anthropic Claude)',
    body:
      'When you capture a highlight, the photo is sent to Anthropic\'s Claude API over HTTPS for one-shot text extraction. Anthropic processes the request to return the extracted text and, per their API policy, does not use API inputs to train their models by default. See anthropic.com/legal for their privacy policy.',
  },
  {
    icon: 'sync-outline',
    heading: 'Optional cloud sync (Pro)',
    body:
      'If you sign in with Google and subscribe to Pro, your highlights, books, notes, and tags are synced to a private Firestore document scoped to your account UID. Firestore security rules enforce that only your signed-in account can read or write that document. Sync is off until you sign in, and can be stopped at any time by signing out.',
  },
  {
    icon: 'person-circle-outline',
    heading: 'Sign-in data',
    body:
      'Google Sign-In shares your Google account ID, email address, display name, and profile photo URL with the app. We use these only to identify you across devices and to display your profile on the Account screen. We do not contact you outside of essential account or billing notifications.',
  },
  {
    icon: 'card-outline',
    heading: 'Billing',
    body:
      'Subscriptions are processed by Google Play Billing. We never see or store your payment details — Google handles them. We only receive the receipt token that proves your subscription status.',
  },
  {
    icon: 'bar-chart-outline',
    heading: 'No analytics or tracking',
    body:
      'We do not use third-party analytics, advertising SDKs, behavioural tracking, fingerprinting, or any cross-app identifiers. The only network calls this app makes are: (1) extraction requests to the Anthropic API, (2) authentication via Google Sign-In, (3) sync to Firestore when signed in, and (4) subscription verification via Google Play.',
  },
  {
    icon: 'shield-checkmark-outline',
    heading: 'Security',
    body:
      'All network requests use HTTPS. Auth credentials are managed by Google Sign-In and Firebase Auth — we never see your password. Local data is stored in your app\'s private storage which other apps cannot read on a non-rooted device.',
  },
  {
    icon: 'trash-outline',
    heading: 'Your data & deletion',
    body:
      'You can export everything as Markdown from Settings → Export. You can delete synced data by signing in and choosing "Delete cloud data" on the Account screen, or by emailing us. Local data is removed by uninstalling the app. If you would like a complete copy of your data or its full deletion, email us using the address below.',
  },
  {
    icon: 'people-outline',
    heading: 'Children',
    body:
      'This app is not directed at children under 13 and we do not knowingly collect data from them. If you believe a child has signed in, contact us and we\'ll remove the account.',
  },
];

const TERMS: Section[] = [
  {
    icon: 'document-text-outline',
    heading: 'Use of the app',
    body:
      'This app is provided "as is", without warranty of any kind. We make a best effort to keep text extraction accurate, but we cannot guarantee a specific result for any given photo — always double-check important quotes against the source.',
  },
  {
    icon: 'star-outline',
    heading: 'Subscriptions',
    body:
      'Pro is billed through Google Play at the price shown on the paywall. Subscriptions auto-renew until cancelled. You can cancel any time from Google Play → Subscriptions; cancellation takes effect at the end of the current billing period. Free-tier extractions are limited per device.',
  },
  {
    icon: 'create-outline',
    heading: 'Content ownership',
    body:
      'You own the highlights, notes, and tags you create. We claim no rights over the text you extract or anything you write in the app. Beautified quote cards generated by the app are yours to use — please respect the copyright of the original book when sharing them.',
  },
  {
    icon: 'image-outline',
    heading: 'Background imagery',
    body:
      'The background images offered in the Beautify feature are bundled with the app and licensed for use within it. You may share cards you create with these backgrounds; you may not extract and redistribute the source images on their own.',
  },
  {
    icon: 'ban-outline',
    heading: 'Acceptable use',
    body:
      'Do not use the app to extract or distribute content you do not have rights to, to harass other users, or to attempt to break the service. We reserve the right to suspend accounts that abuse the extraction service.',
  },
  {
    icon: 'refresh-outline',
    heading: 'Changes to these terms',
    body:
      'If we change these terms in a material way, you\'ll see an in-app notice the next time you open the app. Continued use after that notice constitutes acceptance of the new terms.',
  },
];

export default function Privacy() {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 28 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ gap: 12, paddingTop: 4 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: colors.primary + '18',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
        </View>
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 30,
              fontWeight: '700',
              color: colors.text,
              letterSpacing: -0.6,
            }}
          >
            Privacy & terms
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: colors.textMuted,
                  letterSpacing: 0.3,
                }}
              >
                Updated {LAST_UPDATED}
              </Text>
            </View>
          </View>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 22,
              color: colors.textMuted,
              marginTop: 4,
            }}
          >
            We built Highlight Capture to be lightweight and private. Your reading
            stays on your device unless you opt into cloud sync. Here&apos;s exactly
            what that means.
          </Text>
        </View>
      </View>

      <SectionGroup title="Privacy" sections={PRIVACY} />
      <SectionGroup title="Terms" sections={TERMS} />

      {/* Contact card */}
      <Pressable
        onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.primary + '18',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="mail" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: colors.textSubtle,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Questions or data requests
          </Text>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.text,
              marginTop: 3,
            }}
          >
            {CONTACT_EMAIL}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </Pressable>
    </ScrollView>
  );
}

function SectionGroup({ title, sections }: { title: string; sections: Section[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: colors.textMuted,
          paddingHorizontal: 4,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        {sections.map((s, i) => (
          <View key={s.heading}>
            {i > 0 && (
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginLeft: 56,
                }}
              />
            )}
            <View
              style={{
                flexDirection: 'row',
                gap: 14,
                padding: 16,
                alignItems: 'flex-start',
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                <Ionicons name={s.icon} size={16} color={colors.text} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: colors.text,
                    letterSpacing: -0.1,
                  }}
                >
                  {s.heading}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    lineHeight: 21,
                    color: colors.textMuted,
                  }}
                >
                  {s.body}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
