import { StyleSheet, Text, View } from 'react-native';

import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { AppPage } from '@/components/app/app-page';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { session } = useMobileSession();

  return (
    <RequireMobileAuth>
      <AppPage title="Profil" subtitle="Drawer menu" topBarMode="back" backHref="/(tabs)" scrollable={false}>
        <View style={styles.container}>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.name, { color: palette.headline }]}>
              {[session?.user.firstName, session?.user.lastName].filter(Boolean).join(' ') || 'Client'}
            </Text>
            <Text style={[styles.meta, { color: palette.muted }]}>
              {session?.user.username || session?.user.email || session?.user.phone}
            </Text>
            <Text style={[styles.meta, { color: palette.muted }]}>Role: {session?.user.role}</Text>
          </View>
        </View>
      </AppPage>
    </RequireMobileAuth>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 20, gap: 22 },
  card: { borderWidth: 1, borderRadius: 24, padding: 22, gap: 8 },
  name: { fontSize: 24, fontWeight: '900' },
  meta: { fontSize: 14, lineHeight: 21 },
});
