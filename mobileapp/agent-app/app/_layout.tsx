import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AgentSessionProvider } from '@/providers/agent-session-provider';
import { MobileDrawerProvider } from '@/providers/mobile-drawer-provider';
import { MobileNotificationsProvider } from '@/providers/mobile-notifications-provider';
import { MobilePreferencesProvider } from '@/providers/mobile-preferences-provider';
import { AppThemeProvider, useAppTheme } from '@/providers/app-theme-provider';

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <MobilePreferencesProvider>
        <AgentSessionProvider>
          <MobileNotificationsProvider>
            <RootNavigator />
          </MobileNotificationsProvider>
        </AgentSessionProvider>
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
          <Stack.Screen name="missions/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="missions/[id]/report" options={{ headerShown: false }} />
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
