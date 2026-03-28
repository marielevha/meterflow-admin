import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppPage } from '@/components/app/app-page';
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { isMobileAuthError, toMobileErrorMessage } from '@/lib/api/mobile-client';
import { getClientMeterDetail, type MobileMeter } from '@/lib/api/mobile-meters';
import { getCustomerMeterIndexLabels } from '@/lib/meters/index-labels';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function MeterDetailScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { locale, t } = useI18n();
  const params = useLocalSearchParams<{ id?: string }>();
  const { logout } = useMobileSession();
  const [meter, setMeter] = useState<MobileMeter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      if (!params.id) {
        setError(t('meterDetail.missingId'));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await getClientMeterDetail(params.id);
        if (!active) return;
        setMeter(result.meter);
      } catch (loadError) {
        if (!active) return;
        const message = toMobileErrorMessage(loadError, t('meterDetail.fallback'));
        setError(message);
        if (isMobileAuthError(loadError)) {
          await logout();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      active = false;
    };
  }, [logout, params.id, t]);

  const latestState = meter?.states[0] ?? null;
  const indexLabels = meter ? getCustomerMeterIndexLabels(meter.type, t) : null;

  return (
    <RequireMobileAuth>
      <AppPage title={t('meterDetail.title')} subtitle={t('meterDetail.subtitle')} topBarMode="back" backHref="/meters">
        {loading ? (
          <StateCard text={t('meterDetail.loading')} color={palette.muted} loading palette={palette} />
        ) : error ? (
          <StateCard text={error} color={palette.danger} palette={palette} />
        ) : !meter ? (
          <StateCard text={t('meterDetail.notFound')} color={palette.muted} palette={palette} />
        ) : (
          <>
            <View style={[styles.heroCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={styles.heroRow}>
                <View style={[styles.heroIcon, { backgroundColor: palette.accentSoft }]}>
                  <Ionicons name="flash-outline" size={22} color={palette.accent} />
                </View>
                <View style={styles.heroTextBlock}>
                  <Text style={[styles.heroTitle, { color: palette.headline }]}>{meter.serialNumber}</Text>
                  <Text style={[styles.heroMeta, { color: palette.muted }]}>
                    {meter.meterReference || t('meterDetail.referenceMissing')}
                  </Text>
                </View>
              </View>

              <View style={styles.statusChipRow}>
                <View style={[styles.statusChip, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.statusChipText, { color: palette.primary }]}>{meter.status}</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: palette.surfaceMuted }]}>
                  <Text style={[styles.statusChipText, { color: palette.headline }]}>{meter.type}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('meterDetail.information')}</Text>
              <View style={styles.infoGrid}>
                <InfoItem
                  label={t('meterDetail.cityZone')}
                  value={[meter.city, meter.zone].filter(Boolean).join(' / ') || '--'}
                  palette={palette}
                />
                <InfoItem
                  label={t('meterDetail.address')}
                  value={[meter.addressLine1, meter.addressLine2].filter(Boolean).join(', ') || '--'}
                  palette={palette}
                />
                <InfoItem
                  label={t('meterDetail.installedAt')}
                  value={meter.installedAt ? formatDisplayDate(meter.installedAt, locale) : '--'}
                  palette={palette}
                />
                <InfoItem
                  label={t('meterDetail.lastInspectionAt')}
                  value={meter.lastInspectionAt ? formatDisplayDate(meter.lastInspectionAt, locale) : '--'}
                  palette={palette}
                />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('meterDetail.latestState')}</Text>
              <View style={styles.infoGrid}>
                <InfoItem
                  label={indexLabels?.primaryIndex ?? t('common.index')}
                  value={latestState?.currentPrimary?.toString() ?? '--'}
                  palette={palette}
                />
                {meter.type === 'DUAL_INDEX' || latestState?.currentSecondary !== null ? (
                  <InfoItem
                    label={indexLabels?.secondaryIndex ?? t('common.hcIndex')}
                    value={latestState?.currentSecondary?.toString() ?? '--'}
                    palette={palette}
                  />
                ) : null}
                <InfoItem
                  label={t('meterDetail.effectiveAt')}
                  value={latestState?.effectiveAt ? formatDisplayDate(latestState.effectiveAt, locale) : '--'}
                  palette={palette}
                />
                <InfoItem
                  label={t('meterDetail.assignedAgent')}
                  value={formatAssignedAgent(meter)}
                  palette={palette}
                />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('meterDetail.technicalCoordinates')}</Text>
              <View style={styles.infoGrid}>
                <InfoItem label={t('meterDetail.latitude')} value={meter.latitude?.toString() ?? '--'} palette={palette} />
                <InfoItem label={t('meterDetail.longitude')} value={meter.longitude?.toString() ?? '--'} palette={palette} />
                <InfoItem label={t('meterDetail.createdAt')} value={formatDisplayDate(meter.createdAt, locale)} palette={palette} />
                <InfoItem label={t('meterDetail.updatedAt')} value={formatDisplayDate(meter.updatedAt, locale)} palette={palette} />
              </View>
            </View>
          </>
        )}
      </AppPage>
    </RequireMobileAuth>
  );
}

function StateCard({
  text,
  color,
  loading = false,
  palette,
}: {
  text: string;
  color: string;
  loading?: boolean;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
      {loading ? <CircularLoading palette={palette} size={56} /> : null}
      <Text style={[styles.stateText, { color }]}>{text}</Text>
    </View>
  );
}

function InfoItem({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.infoItem}>
      <Text style={[styles.infoLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: palette.headline }]}>{value}</Text>
    </View>
  );
}

function formatAssignedAgent(meter: MobileMeter) {
  if (!meter.assignedAgent) return '--';

  return (
    [meter.assignedAgent.firstName, meter.assignedAgent.lastName].filter(Boolean).join(' ') ||
    meter.assignedAgent.username ||
    meter.assignedAgent.phone ||
    '--'
  );
}

function formatDisplayDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
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
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextBlock: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  heroMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  statusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  infoGrid: {
    gap: 14,
  },
  infoItem: {
    gap: 5,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
