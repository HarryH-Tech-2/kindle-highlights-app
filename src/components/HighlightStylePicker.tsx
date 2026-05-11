import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { HighlightStyle } from '@/src/db/types';
import { useTheme } from '@/src/theme/ThemeContext';

// Small inline picker shown in the review screen. We keep the option set
// deliberately tight (a handful of curated swatches + an italic toggle) so
// the UI stays self-explanatory and we don't end up with a colour wheel.

type Props = {
  value: HighlightStyle | null;
  onChange: (next: HighlightStyle | null) => void;
};

// Soft, readable swatches that work on both light and dark backgrounds.
// `null` means "use the theme default text color".
const COLORS: Array<{ key: string; value: string | null; label: string }> = [
  { key: 'default', value: null, label: 'Default' },
  { key: 'amber', value: '#d97706', label: 'Amber' },
  { key: 'rose', value: '#e11d48', label: 'Rose' },
  { key: 'emerald', value: '#059669', label: 'Emerald' },
  { key: 'sky', value: '#0284c7', label: 'Sky' },
  { key: 'violet', value: '#7c3aed', label: 'Violet' },
];

export function HighlightStylePicker({ value, onChange }: Props) {
  const { colors } = useTheme();
  const currentColor = value?.color ?? null;
  const italic = !!value?.italic;

  const update = (patch: Partial<HighlightStyle>) => {
    const merged: HighlightStyle = {
      color: value?.color ?? null,
      italic: value?.italic ?? false,
      ...patch,
    };
    // Collapse to null when nothing is set so we don't persist meaningless
    // empty objects.
    const isDefault = !merged.color && !merged.italic;
    onChange(isDefault ? null : merged);
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Colour swatches */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {COLORS.map((c) => {
          const selected = currentColor === c.value;
          const swatch = c.value ?? colors.text;
          return (
            <Pressable
              key={c.key}
              onPress={() => update({ color: c.value })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? swatch : colors.border,
                backgroundColor: selected ? swatch + '14' : colors.surface,
                opacity: pressed ? 0.7 : 1,
              })}
              hitSlop={4}
            >
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: swatch,
                  borderWidth: c.value ? 0 : 1,
                  borderColor: colors.border,
                }}
              />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Italic toggle */}
      <Pressable
        onPress={() => update({ italic: !italic })}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 8,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: italic ? colors.primary : colors.border,
          backgroundColor: italic ? colors.primary + '14' : colors.surface,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Ionicons
          name="text"
          size={16}
          color={italic ? colors.primary : colors.textMuted}
          style={{ fontStyle: 'italic' }}
        />
        <Text
          style={{
            color: italic ? colors.primary : colors.text,
            fontStyle: 'italic',
            fontWeight: '600',
            fontSize: 14,
          }}
        >
          Italic
        </Text>
      </Pressable>
    </View>
  );
}
