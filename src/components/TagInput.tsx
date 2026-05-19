import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/theme/ThemeContext';
import { accentFor } from '@/src/theme/colors';

export function TagInput({
  value,
  onChange,
  suggestions
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (!t) return;
    if (value.includes(t)) return;
    onChange([...value, t]);
    setDraft('');
  };

  const remove = (t: string) => onChange(value.filter((x) => x !== t));

  const filteredSuggestions =
    draft.trim().length > 0
      ? (suggestions ?? []).filter(
          (s) => s.startsWith(draft.trim().toLowerCase()) && !value.includes(s)
        ).slice(0, 5)
      : [];

  return (
    <View style={{ gap: 10 }}>
      {value.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {value.map((t) => {
            const accent = accentFor(t, colors.accentPalette);
            return (
              <Pressable
                key={t}
                onPress={() => remove(t)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingLeft: 10,
                  paddingRight: 6,
                  paddingVertical: 5,
                  backgroundColor: accent + '1f',
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: accent + '55',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: accent, fontSize: 13, fontWeight: '600' }}>
                  #{t}
                </Text>
                <Ionicons name="close" size={14} color={accent} />
              </Pressable>
            );
          })}
        </View>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 10,
          backgroundColor: colors.bg,
        }}
      >
        <Ionicons name="pricetag-outline" size={16} color={colors.textSubtle} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => add(draft)}
          placeholder="Add tag, then press return"
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          returnKeyType="done"
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingLeft: 8,
            color: colors.text,
            fontSize: 15,
          }}
        />
      </View>
      {filteredSuggestions.length > 0 && (
        <View
          style={{
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.bg,
            overflow: 'hidden',
          }}
        >
          {filteredSuggestions.map((s, i) => (
            <Pressable
              key={s}
              onPress={() => add(s)}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 12,
                backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              })}
            >
              <Text style={{ color: colors.text, fontSize: 14 }}>#{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
