import { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from '@/src/db/client';
import * as Tags from '@/src/db/tags';
import { useTagsWithCounts } from '@/src/hooks/useTags';
import { EmptyState } from '@/src/components/EmptyState';
import { useTheme } from '@/src/theme/ThemeContext';
import { accentFor, fonts } from '@/src/theme/colors';
import { Platform } from 'react-native';
import { scheduleSync } from '@/src/sync/scheduler';

export default function TagsList() {
  const router = useRouter();
  const { colors } = useTheme();
  const { tags, refresh } = useTagsWithCounts();
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const onCreate = async () => {
    const name = draftName.trim().toLowerCase();
    if (!name) return;
    setSaving(true);
    try {
      const db = await getDb();
      await Tags.upsertTagByName(db, name);
      setDraftName('');
      setCreating(false);
      await refresh();
      scheduleSync();
    } catch (e: any) {
      Alert.alert('Could not create tag', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    if (saving) return;
    setDraftName('');
    setCreating(false);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 40,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: colors.textMuted,
            }}
          >
            Filed under
          </Text>
          <Text
            style={{
              fontFamily: fonts.serif,
              fontSize: 28,
              color: colors.text,
              marginTop: 2,
              letterSpacing: -0.4,
            }}
          >
            Tags
          </Text>
        </View>
        <Pressable
          onPress={() => setCreating(true)}
          hitSlop={10}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 999,
            backgroundColor: colors.primary,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Ionicons name="add" size={17} color={colors.primaryText} />
          <Text
            style={{
              fontFamily: fonts.sans,
              color: colors.primaryText,
              fontWeight: '700',
              fontSize: 13,
              letterSpacing: 0.3,
            }}
          >
            New tag
          </Text>
        </Pressable>
      </View>

      {tags.length === 0 ? (
        <EmptyState
          icon="pricetag-outline"
          title="No tags yet"
          message="Tag highlights to find them later by theme — mortality, craft, parenting, anything."
        />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 10 }}
          data={tags}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => {
            const accent = accentFor(item.name, colors.accentPalette);
            return (
              <Pressable
                onPress={() => router.push(`/tag/${encodeURIComponent(item.name)}`)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  padding: 16,
                  opacity: pressed ? 0.9 : 1,
                  gap: 14,
                  ...Platform.select({
                    ios: {
                      shadowColor: colors.shadow,
                      shadowOpacity: 0.05,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 3 },
                    },
                    android: { elevation: 1 },
                  }),
                })}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 999,
                    backgroundColor: accent + '24',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.serif,
                      color: accent,
                      fontWeight: '700',
                      fontSize: 18,
                    }}
                  >
                    #
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: fonts.serif,
                      fontSize: 17,
                      fontWeight: '600',
                      color: colors.text,
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.sans,
                      color: colors.textMuted,
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {item.count} highlight{item.count === 1 ? '' : 's'}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal
        visible={creating}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 20,
              gap: 14,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
              New tag
            </Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="tag name"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
              autoFocus
              onSubmitEditing={onCreate}
              returnKeyType="done"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                color: colors.text,
                backgroundColor: colors.bg,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
              <Pressable
                onPress={closeModal}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 10,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: '500' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={onCreate}
                disabled={!draftName.trim() || saving}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor:
                    draftName.trim() && !saving ? colors.primary : colors.border,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    color:
                      draftName.trim() && !saving ? colors.primaryText : colors.textSubtle,
                    fontSize: 15,
                    fontWeight: '600',
                  }}
                >
                  {saving ? 'Saving…' : 'Create'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
