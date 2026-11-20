import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpirationPrompt } from '@/components/expiration-prompt';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { capitalize, daysUntil, usePantryItems } from '@/lib/pantry';
import {
  addItemByName,
  clearAll,
  clearChecked,
  deleteShoppingItem,
  moveCheckedToPantry,
  setChecked,
  useShoppingList,
} from '@/lib/shopping';
import { groupForDisplay, listKey } from '@/lib/shopping-logic';
import { ShoppingListItem } from '@/types/models';

export default function ShoppingScreen() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const theme = useTheme();
  const { items, loading, error } = useShoppingList(user?.uid);
  const pantry = usePantryItems(user?.uid);

  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  // Items just moved to the pantry; while set, the "Add expiration dates now?" prompt shows
  const [movedItems, setMovedItems] = useState<{ id: string; name: string }[] | null>(null);

  const sections = groupForDisplay(items, capitalize);
  const toBuy = items.filter((item) => !item.checked).length;
  const checkedCount = items.length - toBuy;

  // Expired pantry food that isn't on the list yet: probably time to buy more
  const onList = new Set(items.filter((item) => !item.checked).map((item) => item.normalizedName));
  const suggestions = pantry.items
    .filter((item) => {
      const days = daysUntil(item.expirationDate);
      return days !== null && days < 0 && !onList.has(listKey(item.name));
    })
    .slice(0, 5);

  // Run a save, show a short message, and catch errors (e.g. no internet)
  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage('');
    try {
      setMessage(await action());
    } catch {
      setMessage('Something went wrong. Check your internet connection.');
    } finally {
      setBusy(false);
    }
  }

  function handleAdd(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    run(async () => {
      const added = await addItemByName(uid, trimmed, items);
      if (added) setNewName('');
      return added ? '' : `${trimmed} is already on your list.`;
    });
  }

  // Ask first, since this can't be undone
  function handleClearAll() {
    const question = `Remove all ${items.length} items from your shopping list?`;
    const clear = () =>
      run(async () => {
        await clearAll(uid, items);
        return 'Shopping list cleared.';
      });
    if (Platform.OS === 'web') {
      if (window.confirm(question)) clear();
      return;
    }
    Alert.alert('Clear shopping list', question, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: clear },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Shopping List</ThemedText>
          <View style={styles.headerRight}>
            <ThemedText type="small" themeColor="textSecondary">
              {toBuy === 1 ? '1 item to buy' : `${toBuy} items to buy`}
            </ThemedText>
            {items.length > 0 && (
              <Pressable onPress={handleClearAll} disabled={busy} hitSlop={8}>
                <ThemedText type="small" style={styles.error}>
                  Clear list
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.addRow}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={() => handleAdd(newName)}
            placeholder="Add an item, e.g. Bread"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="done"
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <Pressable
            style={[styles.greenButton, (!newName.trim() || busy) && styles.disabled]}
            onPress={() => handleAdd(newName)}
            disabled={!newName.trim() || busy}>
            <ThemedText type="smallBold" style={styles.greenButtonText}>
              Add
            </ThemedText>
          </Pressable>
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            <ThemedText type="small" themeColor="textSecondary">
              Expired in your pantry. Buy more?
            </ThemedText>
            <View style={styles.chipRow}>
              {suggestions.map((item) => (
                <Pressable key={item.id} onPress={() => handleAdd(item.name)} disabled={busy}>
                  <ThemedView type="backgroundElement" style={styles.chip}>
                    <ThemedText type="small">+ {item.name}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {message !== '' && (
          <ThemedText type="small" style={styles.notice}>
            {message}
          </ThemedText>
        )}

        {loading ? (
          <ActivityIndicator style={styles.message} color="#2e7d32" />
        ) : error ? (
          <ThemedText style={[styles.message, styles.error]}>{error}</ThemedText>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={styles.list}
            renderSectionHeader={({ section }) => (
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                {section.title}
              </ThemedText>
            )}
            renderItem={({ item }) => (
              <ListRow
                item={item}
                onToggle={() => run(async () => {
                  await setChecked(uid, item.id, !item.checked);
                  return '';
                })}
                onDelete={() => run(async () => {
                  await deleteShoppingItem(uid, item.id);
                  return '';
                })}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  Your shopping list is empty. Open a recipe and tap{' '}
                  <ThemedText type="smallBold">Add missing to shopping list</ThemedText>, or type an item above.
                </ThemedText>
                <Pressable onPress={() => router.push('/recipes')} hitSlop={8}>
                  <ThemedText type="linkPrimary">Find recipes</ThemedText>
                </Pressable>
              </View>
            }
            ListFooterComponent={
              checkedCount > 0 ? (
                <View style={styles.footer}>
                  <Pressable
                    style={[styles.greenButton, styles.wideButton, busy && styles.disabled]}
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        const moved = await moveCheckedToPantry(uid, items);
                        setMovedItems(moved); // opens the "Add expiration dates now?" prompt
                        return '';
                      })
                    }>
                    <ThemedText type="smallBold" style={styles.greenButtonText}>
                      Done shopping: move {checkedCount} to pantry
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => run(async () => {
                        await clearChecked(uid, items);
                        return '';
                      })}
                    disabled={busy}
                    hitSlop={8}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Remove checked items without adding them
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>

      <ExpirationPrompt
        uid={uid}
        items={movedItems}
        onClose={(doneMessage) => {
          setMovedItems(null);
          setMessage(doneMessage);
        }}
      />
    </ThemedView>
  );
}

// One item: tap the circle (or the name) to check it off, tap ✕ to remove it
function ListRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingListItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const details = [
    item.measure,
    item.sourceRecipeNames?.length ? `for ${item.sourceRecipeNames.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <Pressable onPress={onToggle} style={styles.rowMain} hitSlop={4}>
        <View style={[styles.checkbox, item.checked && styles.checkboxOn]}>
          {item.checked && <ThemedText style={styles.checkmark}>✓</ThemedText>}
        </View>
        <View style={styles.rowText}>
          <ThemedText type="smallBold" style={[styles.itemName, item.checked && styles.checkedText]}>
            {item.name}
          </ThemedText>
          {details !== '' && (
            <ThemedText type="small" themeColor="textSecondary">
              {details}
            </ThemedText>
          )}
        </View>
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={12}>
        <ThemedText themeColor="textSecondary">✕</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    // On web the tab bar sits at the top of the page, so leave room for it
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.three,
  },
  addRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  input: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    fontSize: 16,
  },
  greenButton: {
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenButtonText: {
    color: '#ffffff',
  },
  wideButton: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.5,
  },
  suggestions: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 16,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  notice: {
    color: '#2e7d32',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
  },
  sectionTitle: {
    marginTop: Spacing.three,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2e7d32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: '#2e7d32',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 16,
  },
  rowText: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
  },
  checkedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  footer: {
    marginTop: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  empty: {
    marginTop: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
  },
  message: {
    marginTop: Spacing.five,
    textAlign: 'center',
  },
  error: {
    color: '#d93025',
  },
});
