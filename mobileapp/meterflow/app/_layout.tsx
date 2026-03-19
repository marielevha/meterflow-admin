import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { MobileSessionProvider } from '@/providers/mobile-session-provider';
import { MobileDrawerProvider } from '@/providers/mobile-drawer-provider';
import { MobilePreferencesProvider } from '@/providers/mobile-preferences-provider';
import { MobilePushProvider } from '@/providers/mobile-push-provider';
import { AppThemeProvider, useAppTheme } from '@/providers/app-theme-provider';

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <MobilePreferencesProvider>
        <MobileSessionProvider>
          <MobilePushProvider>
            <RootNavigator />
          </MobilePushProvider>
        </MobileSessionProvider>
      </MobilePreferencesProvider>
    </AppThemeProvider>
  );
}

function RootNavigator() {
  const { navigationTheme, resolvedTheme } = useAppTheme();

  return (
    <ThemeProvider value={navigationTheme}>
      <MobileDrawerProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="readings-history" options={{ headerShown: false }} />
          <Stack.Screen name="consumption/[meterId]" options={{ headerShown: false }} />
          <Stack.Screen name="readings/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="meters" options={{ headerShown: false }} />
          <Stack.Screen name="meters/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="about" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      </MobileDrawerProvider>
    </ThemeProvider>
  );
}
