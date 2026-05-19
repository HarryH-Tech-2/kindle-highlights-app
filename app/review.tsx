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
import { useTheme } from '@/src/theme/ThemeContext';

export default function Review() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ text?: string; id?: string }>();
  const editingId = params.id ? Number(params.id) : null;

  const { books, create: createBook, refresh: refreshBooks } = useBooks();
  const [text, setText] = useState(params.text ?? '');
  const [bookId, setBookId] = useState<number | null>(null);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [style, setStyle] = useState<HighlightStyle | null>(null);
  const [allTagNames, setAllTagNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(editingId != null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const t = await Tags.listTags(db);
      setAllTagNames(t.map((x) => x.name));
      if (editingId != null) {
        const h = await Highlights.getHighlight(db, editingId);
        if (h) {
          setText(h.text);
          setBookId(h.book_id);
          setTagNames(h.tags.map((tg) => tg.name));
          setNote(h.note ?? '');
          setStyle(h.styleParsed);
        }
        setLoading(false);
      }
    })();
  }, [editingId]);

  const canSave = text.trim().length > 0 && bookId != null && !saving;
  const isEditing = editingId != null;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editingId != null) {
        await Highlights.updateHighlight(await getDb(), editingId, {
          text: text.trim(),
          note: note.trim() || null,
          tag_names: tagNames,
          style,
        });
      } else {
        await Highlights.createHighlight(await getDb(), {
          book_id: bookId!,
          text: text.trim(),
          note: note.trim() || null,
          tag_names: tagNames,
          style,
        });
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

        {/* Highlight text — the hero field */}
        <SectionCard colors={colors} icon="text" title="Highlight">
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
          paddingBottom: Platform.OS === 'ios' ? 28 : 16,
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
                {isEditing ? 'Save changes' : 'Save highlight'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
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
