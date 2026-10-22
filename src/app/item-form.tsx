import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import {
  addPantryItem,
  capitalize,
  CATEGORIES,
  deletePantryItem,
  formatDateInput,
  getPantryItem,
  parseDateInput,
  UNITS,
  updatePantryItem,
} from '@/lib/pantry';
import { Category, Unit } from '@/types/models';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { lookupBarcode } from '@/lib/barcode';

export default function ItemFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const { user } = useAuth();
  const theme = useTheme();

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<Unit>('count');
  const [category, setCategory] = useState<Category>('produce');
  const [expiration, setExpiration] = useState('');
  const [barcode, setBarcode] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  // When editing, load the item and fill in the form
  useEffect(() => {
    if (!user || !id) return;
    getPantryItem(user.uid, id)
      .then((item) => {
        if (!item) {
          setError('This item no longer exists.');
          return;
        }
        setName(item.name);
        setQuantity(String(item.quantity));
        setUnit(item.unit);
        setCategory(item.category);
        setExpiration(formatDateInput(item.expirationDate));
        setBarcode(item.barcode ?? '');
      })
      .catch(() => setError("Couldn't load this item."))
      .finally(() => setLoading(false));
  }, [user, id]);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function handleSave() {
    if (!user) return;
    setError('');

    const trimmedName = name.trim();
    const amount = Number(quantity);
    const expirationDate = expiration.trim() ? parseDateInput(expiration) : null;

    if (!trimmedName) return setError('Please enter a name.');
    if (!quantity.trim() || isNaN(amount) || amount <= 0)
      return setError('Quantity must be a number greater than 0.');
    if (expiration.trim() && !expirationDate)
      return setError('Enter the date as YYYY-MM-DD, for example 2026-10-20.');

    const item = {
      name: trimmedName,
      normalizedName: trimmedName.toLowerCase(),
      quantity: amount,
      unit,
      category,
      expirationDate,
      barcode: barcode.trim() || null,
    };

    setSaving(true);
    try {
      if (id) {
        await updatePantryItem(user.uid, id, item);
      } else {
        await addPantryItem(user.uid, { ...item, lowStockThreshold: null });
      }
      close();
    } catch {
      setError("Couldn't save. Check your internet connection and try again.");
      setSaving(false);
    }
  }

  // Fill in the name and category from Open Food Facts
  async function handleLookup(code = barcode) {
    if (!code.trim()) return setError('Enter a barcode first.');
    setError('');
    setLookingUp(true);
    try {
      const product = await lookupBarcode(code);
      if (!product) {
        setError("We couldn't find that barcode. You can type the details instead.");
        return;
      }
      setName(product.name);
      setCategory(product.category);
    } catch {
      setError("Couldn't look up the barcode. Check your internet connection.");
    } finally {
      setLookingUp(false);
    }
  }

  // The camera found a barcode: close it, show the number, and look it up
  function handleScanned(code: string) {
    setScanning(false);
    setBarcode(code);
    handleLookup(code);
  }

  async function deleteItem() {
    if (!user || !id) return;
    setSaving(true);
    try {
      await deletePantryItem(user.uid, id);
      close();
    } catch {
      setError("Couldn't delete. Check your internet connection and try again.");
      setSaving(false);
    }
  }

  // Ask before deleting. Alert doesn't work in a web browser, so use confirm() there.
  function handleDelete() {
    const message = `Remove ${name || 'this item'} from your pantry?`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) deleteItem();
      return;
    }
    Alert.alert('Delete item', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: deleteItem },
    ]);
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color="#2e7d32" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={12}>
            <ThemedText type="linkPrimary">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">{isEditing ? 'Edit item' : 'Add item'}</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.scanButton} onPress={() => setScanning(true)}>
            <ThemedText style={styles.saveText}>Scan barcode</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Barcode (optional)</ThemedText>
          <View style={styles.barcodeRow}>
            <TextInput
              style={[inputStyle, styles.barcodeInput]}
              placeholder="e.g. 0847644008050"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              value={barcode}
              onChangeText={setBarcode}
            />
            <Pressable style={styles.lookupButton} onPress={() => handleLookup()} disabled={lookingUp}>
              {lookingUp ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText style={styles.saveText}>Look up</ThemedText>
              )}
            </Pressable>
          </View>

          <ThemedText type="smallBold">Name</ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Whole Milk"
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
          />

          <ThemedText type="smallBold">Quantity</ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="1"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            value={quantity}
            onChangeText={setQuantity}
          />

          <ThemedText type="smallBold">Unit</ThemedText>
          <ChipRow options={UNITS} selected={unit} onSelect={setUnit} capitalizeLabels={false} />

          <ThemedText type="smallBold">Category</ThemedText>
          <ChipRow options={CATEGORIES} selected={category} onSelect={setCategory} />

          <ThemedText type="smallBold">Expiration date (optional)</ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            maxLength={10}
            value={expiration}
            onChangeText={setExpiration}
          />

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText style={styles.saveText}>{isEditing ? 'Save changes' : 'Add to pantry'}</ThemedText>
            )}
          </Pressable>

          {isEditing ? (
            <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={saving}>
              <ThemedText style={styles.deleteText}>Delete item</ThemedText>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
      <BarcodeScanner
        visible={scanning}
        onScanned={handleScanned}
        onClose={() => setScanning(false)}
      />
    </ThemedView>
  );
}

// A row of tappable chips. The selected one is green.
function ChipRow<T extends string>({
  options,
  selected,
  onSelect,
  capitalizeLabels = true,
}: {
  options: T[];
  selected: T;
  onSelect: (value: T) => void;
  capitalizeLabels?: boolean;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const isSelected = option === selected;
        return (
          <Pressable key={option} onPress={() => onSelect(option)}>
            <ThemedView
              type={isSelected ? undefined : 'backgroundElement'}
              style={[styles.chip, isSelected && styles.chipSelected]}>
              <ThemedText type="small" style={isSelected && styles.chipSelectedText}>
                {capitalizeLabels ? capitalize(option) : option}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth / 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  headerSpacer: {
    width: 50,
  },
  form: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  scanButton: {
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  barcodeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  barcodeInput: {
    flex: 1,
  },
  lookupButton: {
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginBottom: Spacing.two,
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  chip: {
    borderRadius: 16,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  chipSelected: {
    backgroundColor: '#2e7d32',
  },
  chipSelectedText: {
    color: '#ffffff',
  },
  error: {
    color: '#d93025',
  },
  saveButton: {
    marginTop: Spacing.three,
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  saveText: {
    color: '#ffffff',
    fontWeight: 700,
  },
  deleteButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  deleteText: {
    color: '#d93025',
    fontWeight: 700,
  },
});