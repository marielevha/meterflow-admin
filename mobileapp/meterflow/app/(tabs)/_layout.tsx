import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const { t } = useI18n();
  const { isAuthenticated, isReady } = useMobileSession();

  if (!isReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: 78,
          paddingTop: 8,
          borderTopWidth: 1,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('common.home'),
          tabBarIcon: ({ color }) => <Ionicons size={24} name="home-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="readings"
        options={{
          title: t('tabs.readings'),
          tabBarIcon: ({ color }) => <Ionicons size={24} name="camera-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('common.consumption'),
          tabBarIcon: ({ color }) => <Ionicons size={24} name="stats-chart-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
