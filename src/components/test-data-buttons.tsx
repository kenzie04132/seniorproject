import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { clearPantry, loadTestPantry } from '@/lib/test-data';

// Two small buttons for testing. They only show while running with `npx expo start`
// (__DEV__ is true), never in the final build.
export function TestDataButtons() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!__DEV__ || !user) return null;

  async function run(action: () => Promise<void>, doneMessage: string) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      setMessage(doneMessage);
    } catch {
      setMessage('Something went wrong. Check your internet connection.');
    } finally {
      setBusy(false);
    }
  }

  function handleClear() {
    const question = 'Delete EVERY item in this pantry? Only do this on a test account.';
    const clear = () => run(() => clearPantry(user!.uid), 'Pantry cleared.');
    if (Platform.OS === 'web') {
      if (window.confirm(question)) clear();
      return;
    }
    Alert.alert('Clear pantry', question, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete all', style: 'destructive', onPress: clear },
    ]);
  }

  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        Test data:
      </ThemedText>
      <Pressable
        disabled={busy}
        onPress={() => run(() => loadTestPantry(user.uid), 'Added 18 sample items.')}>
        <ThemedText type="linkPrimary">Load sample pantry</ThemedText>
      </Pressable>
      <Pressable disabled={busy} onPress={handleClear}>
        <ThemedText type="linkPrimary" style={styles.danger}>
          Clear pantry
        </ThemedText>
      </Pressable>
      {message ? (
        <ThemedText type="small" themeColor="textSecondary">
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  danger: {
    color: '#d93025',
  },
});
