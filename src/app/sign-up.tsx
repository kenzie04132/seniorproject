import { Link } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { serverTimestamp, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyAuthError } from '@/lib/auth-context';
import { userDoc } from '@/lib/collections';
import { auth } from '@/lib/firebase';

export default function SignUpScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSignUp() {
    setError('');
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const displayName = name.trim() || null;
      if (displayName) await updateProfile(user, { displayName });

      // Create the users/{uid} profile document from the Week 3 schema
      await setDoc(userDoc(user.uid), {
        uid: user.uid,
        email: user.email,
        displayName,
        dietaryPreferences: [],
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.form}>
        <ThemedText type="subtitle">Create account</ThemedText>

        <TextInput
          style={inputStyle}
          placeholder="Name"
          placeholderTextColor={theme.textSecondary}
          autoComplete="name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={inputStyle}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={inputStyle}
          placeholder="Password (at least 6 characters)"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={inputStyle}
          placeholder="Confirm password"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          autoComplete="new-password"
          value={confirm}
          onChangeText={setConfirm}
          onSubmitEditing={handleSignUp}
        />

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Pressable style={styles.button} onPress={handleSignUp} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <ThemedText style={styles.buttonText}>Sign up</ThemedText>
          )}
        </Pressable>

        <Link href="/sign-in">
          <ThemedText type="linkPrimary">Already have an account? Sign in</ThemedText>
        </Link>
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
  form: {
    width: '100%',
    maxWidth: MaxContentWidth / 2,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  error: {
    color: '#d93025',
  },
  button: {
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 700,
  },
});
