import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import type { HighlightWithRelations } from '@/src/db/types';
import { useTheme } from '@/src/theme/ThemeContext';
import {
  ALL_BACKGROUNDS,
  type Background,
} from '@/src/beautify/backgrounds';

// Beautify screen.
//
// Layout: a square "card" at the top (the thing that gets exported), a
// horizontal carousel of background swatches under it, and Save / Share
// actions at the bottom. The card is wrapped in ViewShot — calling
// captureRef on the ref produces a PNG file we can hand to MediaLibrary or
// Sharing. We deliberately size the card the same on screen and on capture
// so what you see is what gets shared (modulo pixel density, which
// captureRef handles via the `result: 'tmpfile'` + native scale).

const CARD_ASPECT = 1; // square — best for IG feed, decent everywhere else.

export default function Beautify() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hid = Number(id);
  const [hl, setHl] = useState<HighlightWithRelations | null>(null);
  const [bg, setBg] = useState<Background>(ALL_BACKGROUNDS[0]);
  const [busy, setBusy] = useState<null | 'save' | 'share'>(null);
  const shotRef = useRef<ViewShot>(null);

  const load = useCallback(async () => {
    const db = await getDb();
    setHl(await Highlights.getHighlight(db, hid));
  }, [hid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!hl) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const capture = async (): Promise<string> => {
    // captureRef returns a file URI we can pass to MediaLibrary / Sharing.
    // `result: 'tmpfile'` is the cross-platform default; `format: 'png'`
    // keeps the gradients/photo backgrounds artefact-free.
    return await captureRef(shotRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
  };

  const onSave = async () => {
    if (busy) return;
    setBusy('save');
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Photo permission needed',
          'Allow photo library access so we can save the card.'
        );
        return;
      }
      const uri = await capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Your card is in the Photos app.');
    } catch (e: unknown) {
      Alert.alert('Save failed', (e as Error)?.message ?? 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    if (busy) return;
    setBusy('share');
    try {
      const uri = await capture();
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch (e: unknown) {
      Alert.alert('Share failed', (e as Error)?.message ?? 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ padding: 6 }}
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
            letterSpacing: -0.3,
          }}
        >
          Beautify
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* The card. We constrain it with aspectRatio so it stays square. */}
        <View style={{ alignItems: 'center' }}>
          <ViewShot
            ref={shotRef}
            options={{ format: 'png', quality: 1 }}
            style={{
              width: '100%',
              maxWidth: 480,
              aspectRatio: CARD_ASPECT,
              borderRadius: 24,
              overflow: 'hidden',
              backgroundColor: '#000',
              elevation: 8,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
            }}
          >
            <Card bg={bg} highlight={hl} />
          </ViewShot>
        </View>

        {/* Background picker */}
        <View style={{ gap: 10 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: colors.textMuted,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              paddingHorizontal: 4,
            }}
          >
            Background
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 4 }}
          >
            {ALL_BACKGROUNDS.map((b) => {
              const selected = b.id === bg.id;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => setBg(b)}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 14,
                    overflow: 'hidden',
                    borderWidth: selected ? 3 : 1,
                    borderColor: selected ? colors.primary : colors.border,
                  }}
                >
                  <Swatch bg={b} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Action bar */}
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          padding: 16,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        <Pressable
          onPress={onSave}
          disabled={busy !== null}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: busy ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          {busy === 'save' ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                Save
              </Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={onShare}
          disabled={busy !== null}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: colors.primary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: busy ? 0.6 : pressed ? 0.9 : 1,
            elevation: 3,
            shadowColor: colors.primary,
            shadowOpacity: 0.3,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          })}
        >
          {busy === 'share' ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <>
              <Ionicons name="share-outline" size={18} color={colors.primaryText} />
              <Text style={{ color: colors.primaryText, fontWeight: '600', fontSize: 16 }}>
                Share
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────
// The thing that gets captured. Layered:
//   1. Background (gradient or photo)
//   2. Scrim — for photos: a top-to-bottom darkening gradient that keeps
//      the photo's mood visible but guarantees text contrast.
//      Gradient backgrounds already control their own contrast.
//   3. Content — quote text + attribution + small wordmark.

function Card({
  bg,
  highlight,
}: {
  bg: Background;
  highlight: HighlightWithRelations;
}) {
  const light = bg.textColor === 'light';
  // High-contrast text colours regardless of theme — these go to other apps.
  const fg = light ? '#ffffff' : '#0f172a';
  const fgMuted = light ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.7)';
  const fgSubtle = light ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.5)';
  // Drop-shadow values applied to the quote: subtle on solid gradients,
  // stronger on photos (where local contrast varies pixel-to-pixel).
  const isPhoto = bg.kind === 'photo';
  const textShadow = light
    ? {
        textShadowColor: 'rgba(0,0,0,0.55)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: isPhoto ? 8 : 4,
      }
    : {
        textShadowColor: 'rgba(255,255,255,0.4)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      };

  return (
    <View style={{ flex: 1 }}>
      {/* 1. background */}
      {bg.kind === 'gradient' ? (
        <LinearGradient
          colors={bg.colors as unknown as readonly [string, string, ...string[]]}
          start={bg.start}
          end={bg.end}
          style={{ ...StyleSheetAbsolute }}
        />
      ) : (
        <Image
          source={bg.source}
          style={{ ...StyleSheetAbsolute, width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      )}

      {/* 2. scrim — only on photos. A vertical dark gradient (~55% top,
          ~25% middle, ~75% bottom) gives consistent legibility without
          flattening the image. */}
      {isPhoto && (
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.55)',
            'rgba(0,0,0,0.25)',
            'rgba(0,0,0,0.75)',
          ]}
          locations={[0, 0.45, 1]}
          style={{ ...StyleSheetAbsolute }}
        />
      )}

      {/* 3. content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 22,
          paddingTop: 16,
          paddingBottom: 18,
        }}
      >
        {/* Opening quotation mark — decorative anchor, sits flush with the
            top padding so the quote that follows reads higher in the card. */}
        <Text
          style={{
            fontSize: 56,
            lineHeight: 48,
            color: fgSubtle,
            fontWeight: '800',
            marginBottom: 2,
            ...textShadow,
          }}
        >
          “
        </Text>

        {/* Quote — top-aligned, immediately under the opening mark. */}
        <Text
          adjustsFontSizeToFit
          numberOfLines={fitLines(highlight.text)}
          style={{
            fontSize: 22,
            lineHeight: 30,
            color: fg,
            fontWeight: '600',
            letterSpacing: -0.2,
            ...textShadow,
          }}
        >
          {highlight.text}
        </Text>

        {/* Spacer pushes the attribution to the bottom. */}
        <View style={{ flex: 1 }} />

        {/* Attribution + wordmark */}
        <View style={{ gap: 12 }}>
          <View
            style={{
              height: 1,
              backgroundColor: light ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.2)',
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: fg,
                  ...textShadow,
                }}
              >
                {highlight.book.title}
              </Text>
              {highlight.book.author && (
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 13,
                    color: fgMuted,
                    marginTop: 2,
                    ...textShadow,
                  }}
                >
                  {highlight.book.author}
                </Text>
              )}
            </View>
            <Text
              style={{
                fontSize: 10,
                color: fgSubtle,
                fontWeight: '600',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Highlight Capture
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// Rough max lines we want the quote to occupy before truncating, scaled by
// text length. `adjustsFontSizeToFit` will shrink to fit within this.
function fitLines(text: string): number {
  const len = text.length;
  if (len < 120) return 6;
  if (len < 240) return 9;
  if (len < 400) return 12;
  return 14;
}

// Reused absolute-fill style.
const StyleSheetAbsolute = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

// ─── Swatch (used in the picker) ────────────────────────────────────────
function Swatch({ bg }: { bg: Background }) {
  if (bg.kind === 'gradient') {
    return (
      <LinearGradient
        colors={bg.colors as unknown as readonly [string, string, ...string[]]}
        start={bg.start}
        end={bg.end}
        style={{ flex: 1 }}
      />
    );
  }
  return (
    <Image source={bg.source} style={{ flex: 1 }} resizeMode="cover" />
  );
}
