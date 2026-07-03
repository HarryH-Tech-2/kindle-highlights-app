import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import * as Tags from '@/src/db/tags';
import type { HighlightStyle } from '@/src/db/types';
import { useBooks } from '@/src/hooks/useBooks';
import { BookPicker } from '@/src/components/BookPicker';
import { TagInput } from '@/src/components/TagInput';
import { HighlightStylePicker } from '@/src/components/HighlightStylePicker';
import { confirm } from '@/src/components/ConfirmDialog';
import * as StoreReview from 'expo-store-review';
import {
  getUsageCount,
  hasPromptedFeedback,
  markFeedbackPrompted,
} from '@/src/db/meta';
import { useTheme } from '@/src/theme/ThemeContext';
import { fontFamilyFor } from '@/src/theme/colors';
import { scheduleSync } from '@/src/sync/scheduler';

export default function Review() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ text?: string; id?: string }>();
  const editingId = params.id ? Number(params.id) : null;

  const { books, create: createBook, refresh: refreshBooks } = useBooks();
  // OCR may return multiple highlighted passages from a single photo (e.g. a
  // paper book page with three highlighter strokes). The model separates them
  // with a blank line; we split on that and keep each as its own editable
  // passage so the user can review them one at a time and save them as
  // separate highlight records.
  const [passages, setPassages] = useState<string[]>(() => splitPassages(params.text ?? ''));
  const [activeIdx, setActiveIdx] = useState(0);
  const [bookId, setBookId] = useState<number | null>(null);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [style, setStyle] = useState<HighlightStyle | null>(null);
  const [allTagNames, setAllTagNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(editingId != null);
  const [saving, setSaving] = useState(false);

  const isMulti = passages.length > 1;
  const text = passages[activeIdx] ?? '';
  const setText = (next: string) => {
    setPassages((prev) => prev.map((p, i) => (i === activeIdx ? next : p)));
  };
  const removeActivePassage = () => {
    if (passages.length <= 1) return;
    setPassages((prev) => prev.filter((_, i) => i !== activeIdx));
    setActiveIdx((i) => Math.max(0, Math.min(i, passages.length - 2)));
  };

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const t = await Tags.listTags(db);
      setAllTagNames(t.map((x) => x.name));
      if (editingId != null) {
        const h = await Highlights.getHighlight(db, editingId);
        if (h) {
          // When editing, we always work with exactly one passage — the
          // original split happens only on first capture.
          setPassages([h.text]);
          setActiveIdx(0);
          setBookId(h.book_id);
          setTagNames(h.tags.map((tg) => tg.name));
          setNote(h.note ?? '');
          setStyle(h.styleParsed);
        }
        setLoading(false);
      }
    })();
  }, [editingId]);

  const trimmedPassages = passages.map((p) => p.trim()).filter((p) => p.length > 0);
  const canSave = trimmedPassages.length > 0 && bookId != null && !saving;
  const isEditing = editingId != null;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const db = await getDb();
      if (editingId != null) {
        await Highlights.updateHighlight(db, editingId, {
          text: trimmedPassages[0],
          note: note.trim() || null,
          tag_names: tagNames,
          style,
        });
      } else {
        // Save each non-empty passage as its own highlight record, sharing
        // the same book, tags, note, and style. For single-passage capture
        // this collapses to the original one-highlight behavior.
        for (const t of trimmedPassages) {
          await Highlights.createHighlight(db, {
            book_id: bookId!,
            text: t,
            note: note.trim() || null,
            tag_names: tagNames,
            style,
          });
        }
      }
      scheduleSync();

      // After the user's second highlight ever, ask for a review once via
      // the native Play In-App Review API. requestReview() opens a system
      // overlay (when Play's quota allows) on top of whatever screen we
      // navigate to next — it doesn't block, so we can fire-and-forget
      // and route home immediately. Using >= 2 (rather than === 2) so a
      // multi-passage capture that vaults the count past 2 in a single
      // save still triggers the ask. We still gate on a local "asked
      // once" flag because Play silently no-ops the request once its own
      // quota is hit, and we don't want to spam the call on every save.
      if (editingId == null) {
        const count = await getUsageCount(db);
        const alreadyAsked = await hasPromptedFeedback(db);
        if (count >= 2 && !alreadyAsked) {
          await markFeedbackPrompted(db);
          try {
            if (await StoreReview.isAvailableAsync()) {
              // Fire-and-forget — the system overlay manages itself and
              // dismisses without any callback. Errors here are non-fatal.
              void StoreReview.requestReview();
            }
          } catch {
            // Best effort — never block save flow on review SDK hiccups.
          }
        }
      }

      router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = async () => {
    if (await confirm({
      title: isEditing ? 'Discard changes?' : 'Discard?',
      message: 'Your changes will be lost.',
      confirmLabel: 'Discard',
      destructive: true,
    })) {
      router.replace('/');
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const previewColor = style?.color ?? colors.text;
  const previewFont = fontFamilyFor(style?.font);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ marginBottom: 4 }}>
          <Text
            style={{
              fontSize: 26,
              fontWeight: '700',
              color: colors.text,
              letterSpacing: -0.5,
            }}
          >
            {isEditing ? 'Edit highlight' : 'New highlight'}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>
            {isEditing
              ? 'Tweak the text, change the book, or restyle.'
              : 'Confirm the text and choose where it belongs.'}
          </Text>
        </View>

        {/* Highlight text — the hero field. When the OCR returned multiple
            marked passages, a chip row above the input lets the user flip
            between them; each chip edits its own passage and they all save
            as separate highlight records sharing the metadata below. */}
        <SectionCard
          colors={colors}
          icon="text"
          title="Highlight"
          subtitle={
            isMulti
              ? `${passages.length} passages detected — review and save each one`
              : undefined
          }
        >
          {isMulti && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              {passages.map((_, i) => (
                <Pressable
                  key={i}
                  onPress={() => setActiveIdx(i)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor:
                      i === activeIdx ? colors.primary : colors.surfaceAlt,
                  }}
                >
                  <Text
                    style={{
                      color:
                        i === activeIdx ? colors.primaryText : colors.textMuted,
                      fontSize: 12,
                      fontWeight: '700',
                      letterSpacing: 0.3,
                    }}
                  >
                    {i + 1}
                  </Text>
                </Pressable>
              ))}
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={removeActivePassage}
                hitSlop={10}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  borderRadius: 8,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>
                  Remove
                </Text>
              </Pressable>
            </View>
          )}
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Paste or type the passage…"
            placeholderTextColor={colors.textSubtle}
            style={{
              minHeight: 132,
              padding: 14,
              borderRadius: 12,
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
              color: previewColor,
              fontFamily: previewFont,
              fontStyle: style?.italic ? 'italic' : 'normal',
              fontSize: 17,
              lineHeight: 25,
              textAlignVertical: 'top',
            }}
          />
        </SectionCard>

        {/* Book picker */}
        <SectionCard
          colors={colors}
          icon="book"
          title="Book"
          required
          satisfied={bookId != null}
        >
          <BookPicker
            books={books}
            selectedId={bookId}
            onSelect={setBookId}
            onCreate={async (title, author) => {
              const b = await createBook({ title, author });
              await refreshBooks();
              return b;
            }}
          />
        </SectionCard>

        {/* Tags */}
        <SectionCard colors={colors} icon="pricetags" title="Tags">
          <TagInput value={tagNames} onChange={setTagNames} suggestions={allTagNames} />
        </SectionCard>

        {/* Style */}
        <SectionCard colors={colors} icon="color-palette" title="Style">
          <HighlightStylePicker value={style} onChange={setStyle} />
        </SectionCard>

        {/* Note */}
        <SectionCard colors={colors} icon="create" title="Note" subtitle="Optional">
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Why does this passage matter to you?"
            placeholderTextColor={colors.textSubtle}
            style={{
              minHeight: 80,
              padding: 14,
              borderRadius: 12,
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.text,
              fontSize: 15,
              lineHeight: 22,
              textAlignVertical: 'top',
            }}
          />
        </SectionCard>
      </ScrollView>

      {/* Sticky action bar */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 12,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <Pressable
          onPress={onDiscard}
          disabled={saving}
          style={({ pressed }) => ({
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 15 }}>
            Discard
          </Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={!canSave}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: canSave ? colors.primary : colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            opacity: pressed && canSave ? 0.9 : 1,
            // Subtle elevation so the primary action reads as raised.
            elevation: canSave ? 3 : 0,
            shadowColor: canSave ? colors.primary : 'transparent',
            shadowOpacity: canSave ? 0.3 : 0,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          })}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <>
              <Ionicons
                name={isEditing ? 'checkmark' : 'add'}
                size={18}
                color={canSave ? colors.primaryText : colors.textSubtle}
              />
              <Text
                style={{
                  color: canSave ? colors.primaryText : colors.textSubtle,
                  fontWeight: '600',
                  fontSize: 16,
                }}
              >
                {isEditing
                  ? 'Save changes'
                  : trimmedPassages.length > 1
                    ? `Save ${trimmedPassages.length} highlights`
                    : 'Save highlight'}
              </Text>
            </>
          )}
        </Pressable>
      </View>

    </KeyboardAvoidingView>
  );
}

// The OCR prompt separates multiple highlighted passages with a blank line.
// We split on one or more blank lines so each distinct marked region becomes
// its own editable passage. Single-passage captures collapse to a one-item
// array, and empty input collapses to a single empty string so the editor
// always renders at least one field.
function splitPassages(raw: string): string[] {
  const parts = raw.split(/\n\s*\n+/).map((s) => s.trim()).filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [raw];
}

// A consistent surface for each form section. Surfacing the icon + title at
// the top of the card gives the form a scannable rhythm; before, every
// field was a bare label on the background which read as a wireframe.
function SectionCard({
  colors,
  icon,
  title,
  subtitle,
  required,
  satisfied,
  children,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  // When a section is required, we show a small "Required" pill until the
  // value is filled in. It quietly turns into a green check when satisfied.
  required?: boolean;
  satisfied?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            backgroundColor: colors.primary + '1a',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
            {title}
          </Text>
          {subtitle && (
            <Text style={{ color: colors.textSubtle, fontSize: 12, marginTop: 1 }}>
              {subtitle}
            </Text>
          )}
        </View>
        {required && (
          satisfied ? (
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          ) : (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: colors.accent + '22',
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>
                REQUIRED
              </Text>
            </View>
          )
        )}
      </View>
      {children}
    </View>
  );
}
