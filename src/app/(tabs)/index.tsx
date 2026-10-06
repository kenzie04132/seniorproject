import { signOut } from 'firebase/auth';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { auth } from '@/lib/firebase';

// Placeholder Pantry screen. The real pantry list gets built in Week 5.
export default function PantryScreen() {
  const { user } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">My Pantry</ThemedText>
        <ThemedText themeColor="textSecondary">
          Signed in as {user?.displayName ?? user?.email}
        </ThemedText>
        <ThemedText>Your pantry items will show up here.</ThemedText>

        <Pressable style={styles.button} onPress={() => signOut(auth)}>
          <ThemedText style={styles.buttonText}>Sign out</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  button: {
    marginTop: Spacing.four,
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 700,
  },
});