import { Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateInput, parseDateInput, updatePantryItem } from '@/lib/pantry';

type MovedItem = { id: string; name: string };

// Shortcuts so users don't have to type a whole date
const QUICK_PICKS = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
];

function dateInDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDateInput(Timestamp.fromDate(date));
}

// Pops up after "Done shopping: move to pantry".
// First asks "Add expiration dates now?" -> Later closes it,
// "Add dates now" shows a date box for each item that was just moved.
// `items` is null when the prompt is closed.
export function ExpirationPrompt({
  uid,
  items,
  onClose,
}: {
  uid: string;
  items: MovedItem[] | null;
  onClose: (message: string) => void;
}) {
  const theme = useTheme();
  const [step, setStep] = useState<'ask' | 'dates'>('ask');
  const [dates, setDates] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Start fresh every time the prompt opens
  useEffect(() => {
    if (items) {
      setStep('ask');
      setDates({});
      setError('');
    }
  }, [items]);

  if (!items) return null;
  const count = items.length;
  const later = `Moved ${count} ${count === 1 ? 'item' : 'items'} to your pantry. You can add expiration dates later by tapping them on the Pantry tab.`;

  async function save() {
    // Blank boxes are skipped (no date yet). Anything else must be a real date.
    const filled = items!.filter((item) => dates[item.id]?.trim());
    const parsed = filled.map((item) => ({ item, date: parseDateInput(dates[item.id]) }));
    const bad = parsed.find((p) => !p.date);
    if (bad) {
      setError(`Check the date for ${bad.item.name}. Use YYYY-MM-DD, for example ${dateInDays(7)}.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await Promise.all(parsed.map((p) => updatePantryItem(uid, p.item.id, { expirationDate: p.date })));
      const skipped = count - parsed.length;
      onClose(
        `Moved ${count} ${count === 1 ? 'item' : 'items'} to your pantry` +
          (skipped > 0 ? `. ${skipped} still need an expiration date.` : ' with their expiration dates.')
      );
    } catch {
      setError('Something went wrong. Check your internet connection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onClose(later)}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.box}>
          {step === 'ask' ? (
            <>
              <ThemedText type="smallBold" style={styles.title}>
                Add expiration dates now?
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                You moved {count} {count === 1 ? 'item' : 'items'} to your pantry. Adding the date from the
                package now helps SmartPantry tell you what to use first.
              </ThemedText>
              <View style={styles.buttons}>
                <Pressable style={styles.secondaryButton} onPress={() => onClose(later)}>
                  <ThemedText type="smallBold">Later</ThemedText>
                </Pressable>
                <Pressable style={styles.greenButton} onPress={() => setStep('dates')}>
                  <ThemedText type="smallBold" style={styles.greenText}>
                    Add dates now
                  </ThemedText>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <ThemedText type="smallBold" style={styles.title}>
                Expiration dates
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Type the date (YYYY-MM-DD) or pick a shortcut. Leave a box empty to skip that item.
              </ThemedText>
              <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {items.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <ThemedText type="smallBold">{item.name}</ThemedText>
                    <TextInput
                      value={dates[item.id] ?? ''}
                      onChangeText={(text) => setDates({ ...dates, [item.id]: text })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                    />
                    <View style={styles.chipRow}>
                      {QUICK_PICKS.map((pick) => (
                        <Pressable
                          key={pick.label}
                          onPress={() => setDates({ ...dates, [item.id]: dateInDays(pick.days) })}>
                          <ThemedView type="backgroundElement" style={styles.chip}>
                            <ThemedText type="small">{pick.label}</ThemedText>
                          </ThemedView>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
              {error !== '' && (
                <ThemedText type="small" style={styles.error}>
                  {error}
                </ThemedText>
              )}
              <View style={styles.buttons}>
                <Pressable style={styles.secondaryButton} onPress={() => onClose(later)} disabled={saving}>
                  <ThemedText type="smallBold">Skip</ThemedText>
                </Pressable>
                <Pressable style={[styles.greenButton, saving && styles.disabled]} onPress={save} disabled={saving}>
                  <ThemedText type="smallBold" style={styles.greenText}>
                    {saving ? 'Saving...' : 'Save dates'}
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  box: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 12,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
  },
  list: {
    flexGrow: 0,
    marginTop: Spacing.two,
  },
  listContent: {
    gap: Spacing.three,
  },
  itemRow: {
    gap: Spacing.one,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 16,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two + Spacing.one,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  greenButton: {
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  greenText: {
    color: '#ffffff',
  },
  secondaryButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    color: '#d93025',
  },
});
