import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { AppPage } from '@/components/app/app-page';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function NotificationsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <RequireMobileAuth>
      <AppPage title="Notifications" subtitle="Drawer menu" scrollable={false}>
        <View style={styles.container}>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}>
              <Ionicons name="notifications-outline" size={24} color={palette.accent} />
            </View>

            <Text style={[styles.title, { color: palette.headline }]}>Centre de notifications</Text>
            <Text style={[styles.text, { color: palette.muted }]}>
              Cette page accueillera bientôt les rappels de relève, le suivi des traitements et les informations de
              facturation.
            </Text>
          </View>
        </View>
      </AppPage>
    </RequireMobileAuth>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
});
