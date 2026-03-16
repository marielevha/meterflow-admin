import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppPage } from '@/components/app/app-page';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { listClientReadings, type MobileReading } from '@/lib/api/mobile-readings';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function HistoryScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { session, logout } = useMobileSession();
  const [readings, setReadings] = useState<MobileReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReadings() {
      if (!session?.accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await listClientReadings(session.accessToken);
        if (!active) return;
        setReadings(result.readings);
      } catch (loadError) {
        if (!active) return;
        const message = loadError instanceof Error ? loadError.message : 'Impossible de charger les relevés.';
        setError(message);

        if (message.includes('Session invalide')) {
          logout();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadReadings();

    return () => {
      active = false;
    };
  }, [logout, session?.accessToken]);

  return (
    <RequireMobileAuth>
      <AppPage title="Historique" subtitle="Mes releves">
        {loading ? (
          <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={[styles.stateText, { color: palette.muted }]}>Chargement des relevés...</Text>
          </View>
        ) : error ? (
          <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <Text style={[styles.stateText, { color: palette.danger }]}>{error}</Text>
          </View>
        ) : readings.length === 0 ? (
          <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <Text style={[styles.stateText, { color: palette.muted }]}>Aucun relevé disponible pour le moment.</Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {readings.map((reading) => (
              <Pressable
                key={reading.id}
                onPress={() => router.push(`/readings/${reading.id}`)}
                style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.code, { color: palette.headline }]}>{reading.meter.serialNumber}</Text>
                    <Text style={[styles.meta, { color: palette.muted }]}>
                      {formatDisplayDate(reading.readingAt)}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, statusPillStyle(reading.status, palette)]}>
                    <Text style={[styles.statusText, statusTextStyle(reading.status, palette)]}>
                      {reading.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Ionicons name="flash-outline" size={16} color={palette.accent} />
                  <Text style={[styles.indexValue, { color: palette.headline }]}>
                    {reading.primaryIndex ?? '--'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </AppPage>
    </RequireMobileAuth>
  );
}

function statusPillStyle(status: string, palette: (typeof Colors)['light']) {
  if (status === 'validated') return { backgroundColor: `${palette.success}1f` };
  if (status === 'rejected') return { backgroundColor: `${palette.danger}1a` };
  return { backgroundColor: palette.accentSoft };
}

function statusTextStyle(status: string, palette: (typeof Colors)['light']) {
  if (status === 'validated') return { color: palette.success };
  if (status === 'rejected') return { color: palette.danger };
  return { color: palette.primary };
}

function formatDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  stateCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    gap: 10,
    alignItems: 'center',
  },
  stateText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  code: {
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  indexValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
});
