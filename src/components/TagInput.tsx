import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';

export function TagInput({
  value,
  onChange,
  suggestions
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
}) {
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
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {value.map((t) => (
          <Pressable
            key={t}
            onPress={() => remove(t)}
            style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#eef', borderRadius: 12 }}
          >
            <Text>#{t} ✕</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => add(draft)}
        placeholder="Add tag, then press return"
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
      />
      {filteredSuggestions.length > 0 && (
        <View style={{ marginTop: 6 }}>
          {filteredSuggestions.map((s) => (
            <Pressable key={s} onPress={() => add(s)} style={{ padding: 8 }}>
              <Text>#{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
