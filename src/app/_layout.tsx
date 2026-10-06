import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/lib/auth-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootNavigator />
        <AnimatedSplashOverlay />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  // Wait until Firebase knows whether someone is signed in
  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Only signed-in users can reach the main app */}
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>

      {/* Only signed-out users can reach the login screens */}
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}