import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { OfflineBanner } from '@/components/offline-banner';
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
    <View style={{ flex: 1 }}>
      {/* "You're offline" strip, only while signed in and without internet */}
      {user && <OfflineBanner />}
      <Stack screenOptions={{ headerShown: false }}>
        {/* Only signed-in users can reach the main app */}
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="item-form" options={{ presentation: 'modal' }} />
          <Stack.Screen name="recipe" />
          <Stack.Screen name="my-recipe-form" options={{ presentation: 'modal' }} />
        </Stack.Protected>

        {/* Only signed-out users can reach the login screens */}
        <Stack.Protected guard={!user}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
        </Stack.Protected>
      </Stack>
    </View>
  );
}