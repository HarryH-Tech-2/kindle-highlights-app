import { ScrollView, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeContext';

// Plain-English privacy & terms page. We deliberately keep this as static
// in-app copy rather than a webview so it works offline and renders in the
// user's theme. If the legal text ever needs versioning, move it to a remote
// markdown file and render it here.

type Section = { heading: string; body: string };

const PRIVACY: Section[] = [
  {
    heading: 'What we store',
    body:
      'Your books, highlights, notes, and tags are stored in a local SQLite database on your device. You can export or delete this data at any time from Settings.',
  },
  {
    heading: 'Photos of your Kindle',
    body:
      'When you capture a highlight, the photo is sent to Anthropic\'s Claude API for one-shot text extraction and then deleted from your device immediately. We do not save the photo, and Anthropic does not train on API requests by default.',
  },
  {
    heading: 'Optional cloud sync',
    body:
      'If you sign in and subscribe to Pro, your highlights are synced to a private Firestore document scoped to your account. Only you can read or write it. Sync is off by default and can be disabled at any time by signing out.',
  },
  {
    heading: 'Analytics & tracking',
    body:
      'We do not use third-party analytics, ad networks, or behavioural tracking. The only network requests the app makes are: (1) extraction calls to the Anthropic API, (2) authentication via Google Sign-In, and (3) sync to Firestore when you are signed in to Pro.',
  },
  {
    heading: 'Account deletion',
    body:
      'You can delete your synced data by signing in, going to Settings → Account, and choosing "Delete cloud data". Local data is removed by uninstalling the app or clearing its storage.',
  },
];

const TERMS: Section[] = [
  {
    heading: 'Use of the app',
    body:
      'This app is provided as-is, without warranty. We make a best effort to keep extraction accurate, but we can\'t guarantee a specific result for any given photo — always double-check important quotes against the source.',
  },
  {
    heading: 'Subscriptions',
    body:
      'Pro is billed through Google Play. You can cancel at any time from your Play subscriptions; cancellation takes effect at the end of the current billing period. Free-tier extractions are limited and reset is not guaranteed.',
  },
  {
    heading: 'Content ownership',
    body:
      'You own the highlights and notes you capture. We claim no rights over the text you extract or anything you write in the app.',
  },
  {
    heading: 'Changes',
    body:
      'If these terms change in a material way, you\'ll see an in-app notice the next time you open the app. Continued use after the notice constitutes acceptance.',
  },
];

const CONTACT = 'For questions about your data or these terms, email harry@example.com.';

export default function Privacy() {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 24, paddingBottom: 48, gap: 28 }}
    >
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.4 }}>
          Privacy & terms
        </Text>
        <Text style={{ fontSize: 14, color: colors.textMuted }}>
          Last updated: May 2026
        </Text>
      </View>

      <SectionGroup title="Privacy" sections={PRIVACY} />
      <SectionGroup title="Terms" sections={TERMS} />

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 20,
        }}
      >
        <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textMuted }}>
          {CONTACT}
        </Text>
      </View>
    </ScrollView>
  );
}

function SectionGroup({ title, sections }: { title: string; sections: Section[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 18 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: colors.textMuted,
        }}
      >
        {title}
      </Text>
      {sections.map((s) => (
        <View key={s.heading} style={{ gap: 6 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>
            {s.heading}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 22, color: colors.textMuted }}>
            {s.body}
          </Text>
        </View>
      ))}
    </View>
  );
}
