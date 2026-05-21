import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/theme/ThemeContext';

// Plain-English privacy & terms page. Static in-app copy (rather than a
// webview) so it works offline and renders in the user's theme. If the
// legal text ever needs versioning, move it to a remote markdown file and
// render it here.

type Section = { icon: IconName; heading: string; body: string };
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const LAST_UPDATED = 'May 2026';

// Note: when signed in, highlight content (book titles, authors, the highlight
// text itself, your notes, and tag names) is uploaded to our Firestore
// backend so it can sync across your devices. Keep the sections below in
// sync with what runSync actually writes to Firestore.

const PRIVACY: Section[] = [
  {
    icon: 'phone-portrait-outline',
    heading: 'Where your highlights live',
    body:
      'Your books, highlights, notes, and tags are kept in a local SQLite database on your device for fast, offline access. When you are signed in, the same data is also uploaded to our Firebase Firestore backend so it syncs to your other devices. You can export everything as Markdown at any time from Settings, or remove the synced copy by signing out (which also clears local data on this device).',
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
    heading: 'Cloud sync (Firebase Firestore)',
    body:
      'When you are signed in with Google, your books, highlights, notes, and tags are continuously synced to a private Firestore collection scoped to your Google account ID (users/{your-uid}/...). Firestore security rules enforce that only your signed-in account can read or write that data. Sync happens automatically after every change and only while signed in — sign out and the device stops syncing and clears its local copy.',
  },
  {
    icon: 'person-circle-outline',
    heading: 'Sign-in data',
    body:
      'Google Sign-In shares your Google account ID, email address, display name, and profile photo URL with the app. We use these only to identify you across devices, to scope your synced data to your account, and to display your profile in Settings. We do not contact you outside of essential account or billing notifications.',
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
      'We do not use third-party analytics, advertising SDKs, behavioral tracking, fingerprinting, or any cross-app identifiers. The only network calls this app makes are: (1) extraction requests to the Anthropic API, (2) authentication via Google Sign-In, (3) sync to Firestore when signed in, and (4) subscription verification via Google Play.',
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
      'You can export everything as Markdown from Settings → Export. Signing out from Settings stops sync on this device and wipes its local copy. Uninstalling the app removes all local data on the device.',
  },
  {
    icon: 'people-outline',
    heading: 'Children',
    body:
      'This app is not directed at children under 13 and we do not knowingly collect data from them.',
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
      'Pro is billed through Google Play at the price shown on the paywall. Subscriptions auto-renew until canceled. You can cancel any time from Google Play → Subscriptions; cancellation takes effect at the end of the current billing period. Free-tier extractions are limited per device.',
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
            We built Highlight Capture to be lightweight and private. Your
            highlights live on your device for offline access and, while you
            are signed in, also sync to your private Firebase account so they
            follow you across devices. Here&apos;s exactly what that means.
          </Text>
        </View>
      </View>

      <SectionGroup title="Privacy" sections={PRIVACY} />
      <SectionGroup title="Terms" sections={TERMS} />
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
