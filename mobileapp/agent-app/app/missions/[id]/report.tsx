import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppPage } from '@/components/app/app-page';
import { AppStateCard } from '@/components/app/app-state-card';
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireAgentAuth } from '@/components/auth/require-agent-auth';
import { AuthInput } from '@/components/auth/auth-input';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import {
  getAgentTaskDetail,
  submitAgentTaskResult,
  type AgentMissionDetail,
  type AgentMissionResolutionCode,
} from '@/lib/api/agent-tasks';
import { isAgentAuthError, toAgentErrorMessage } from '@/lib/api/agent-client';
import { uploadTaskEvidence } from '@/lib/api/agent-uploads';
import { useAgentSession } from '@/providers/agent-session-provider';
import { useMobileNotifications } from '@/providers/mobile-notifications-provider';

type Step = 'capture' | 'preview' | 'form';

type CapturedTaskPhoto = {
  uri: string;
  capturedAt: string;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAccuracyMeters: number | null;
};

type CapturedTaskPhotoLocation = {
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAccuracyMeters: number | null;
};

const MAX_IMAGE_SIZE_MB = 8;

export default function MissionReportScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { t, locale } = useI18n();
  const params = useLocalSearchParams<{ id?: string }>();
  const { logout } = useAgentSession();
  const { refreshUnreadCount } = useMobileNotifications();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [mission, setMission] = useState<AgentMissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('capture');
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedTaskPhoto | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOutcomeSelect, setShowOutcomeSelect] = useState(false);
  const [resolutionCode, setResolutionCode] = useState<AgentMissionResolutionCode | null>(null);
  const [comment, setComment] = useState('');
  const [primaryIndex, setPrimaryIndex] = useState('');
  const [secondaryIndex, setSecondaryIndex] = useState('');

  useEffect(() => {
    let active = true;

    async function loadMission() {
      if (!params.id) {
        setError(t('missions.notFoundDescription'));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await getAgentTaskDetail(params.id);
        if (!active) return;
        setMission(result.mission);
      } catch (loadError) {
        if (!active) return;
        const message = toAgentErrorMessage(loadError, t('missions.loadingFallback'));
        setError(message);
        if (isAgentAuthError(loadError)) {
          await logout();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadMission();

    return () => {
      active = false;
    };
  }, [logout, params.id, t]);

  const resolutionOptions = useMemo(
    () => [
      { value: 'READING_CONFIRMED' as const, label: t('missions.resolutionReadingConfirmed') },
      { value: 'READING_IMPOSSIBLE' as const, label: t('missions.resolutionReadingImpossible') },
      { value: 'METER_INACCESSIBLE' as const, label: t('missions.resolutionMeterInaccessible') },
      { value: 'METER_DAMAGED_OR_MISSING' as const, label: t('missions.resolutionMeterDamaged') },
      { value: 'SUSPECTED_FRAUD' as const, label: t('missions.resolutionSuspectedFraud') },
      { value: 'CUSTOMER_ABSENT' as const, label: t('missions.resolutionCustomerAbsent') },
      { value: 'ESCALATION_REQUIRED' as const, label: t('missions.resolutionEscalation') },
    ],
    [t]
  );

  const requiresIndexes = resolutionCode === 'READING_CONFIRMED';
  const selectedResolutionLabel =
    resolutionOptions.find((item) => item.value === resolutionCode)?.label ?? t('missions.selectResolution');

  async function handleCapture() {
    if (!cameraRef.current || isCapturing) {
      return;
    }

    setIsCapturing(true);

    try {
      const locationPermission = await Location.requestForegroundPermissionsAsync();
      if (!locationPermission.granted) {
        Alert.alert(t('missions.locationRequiredTitle'), t('missions.locationRequiredBody'));
        return;
      }

      const [photo, location] = await Promise.all([
        cameraRef.current.takePictureAsync({
          quality: 0.82,
          shutterSound: false,
        }),
        getTaskLocationWithTimeout(),
      ]);

      if (!photo?.uri) {
        throw new Error('photo_missing');
      }

      if (location.gpsLatitude === null || location.gpsLongitude === null) {
        Alert.alert(t('missions.locationMissingTitle'), t('missions.locationMissingBody'));
        return;
      }

      setCapturedPhoto({
        uri: photo.uri,
        capturedAt: new Date().toISOString(),
        gpsLatitude: location.gpsLatitude,
        gpsLongitude: location.gpsLongitude,
        gpsAccuracyMeters: location.gpsAccuracyMeters,
      });
      setStep('preview');
    } catch (captureError) {
      Alert.alert(t('missions.captureErrorTitle'), toCaptureErrorMessage(captureError));
    } finally {
      setIsCapturing(false);
    }
  }

  async function handleSubmit() {
    if (!mission || !capturedPhoto || !resolutionCode || isSubmitting) {
      return;
    }

    if (capturedPhoto.gpsLatitude === null || capturedPhoto.gpsLongitude === null) {
      Alert.alert(t('missions.locationMissingTitle'), t('missions.locationMissingBody'));
      return;
    }

    const primaryValue = Number(primaryIndex);
    const secondaryValue = Number(secondaryIndex);

    if (requiresIndexes && (!Number.isFinite(primaryValue) || primaryValue < 0)) {
      Alert.alert(t('missions.invalidIndexTitle'), t('missions.invalidPrimaryIndexBody'));
      return;
    }

    if (
      requiresIndexes &&
      mission.meter.type === 'DUAL_INDEX' &&
      (!Number.isFinite(secondaryValue) || secondaryValue < 0)
    ) {
      Alert.alert(t('missions.invalidIndexTitle'), t('missions.invalidSecondaryIndexBody'));
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedFile = await uploadTaskEvidence(capturedPhoto.uri, {
        maxSizeBytes: MAX_IMAGE_SIZE_MB * 1024 * 1024,
      });

      await submitAgentTaskResult(mission.id, {
        resolutionCode,
        comment,
        readingAt: capturedPhoto.capturedAt,
        ...(requiresIndexes ? { primaryIndex: primaryValue } : {}),
        ...(requiresIndexes && mission.meter.type === 'DUAL_INDEX' ? { secondaryIndex: secondaryValue } : {}),
        imageUrl: uploadedFile.url,
        imageHash: uploadedFile.sha256,
        imageMimeType: uploadedFile.mimeType,
        imageSizeBytes: uploadedFile.sizeBytes,
        gpsLatitude: capturedPhoto.gpsLatitude,
        gpsLongitude: capturedPhoto.gpsLongitude,
        ...(capturedPhoto.gpsAccuracyMeters !== null
          ? { gpsAccuracyMeters: capturedPhoto.gpsAccuracyMeters }
          : {}),
      });

      await refreshUnreadCount();

      Alert.alert(t('missions.reportSuccessTitle'), t('missions.reportSuccessBody'), [
        {
          text: t('missions.backToMission'),
          onPress: () => {
            resetFlow();
            router.back();
          },
        },
      ]);
    } catch (submitError) {
      if (isAgentAuthError(submitError)) {
        await logout();
      }
      Alert.alert(t('missions.submitErrorTitle'), toAgentErrorMessage(submitError, t('missions.submitErrorBody')));
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetFlow() {
    setStep('capture');
    setCapturedPhoto(null);
    setResolutionCode(null);
    setComment('');
    setPrimaryIndex('');
    setSecondaryIndex('');
    setShowOutcomeSelect(false);
  }

  if (loading) {
    return (
      <RequireAgentAuth>
        <AppPage title={t('missions.reportTitle')} topBarMode="back" backHref={params.id ? `/missions/${params.id}` : '/(tabs)/explore'}>
          <View style={styles.centerWrap}>
            <CircularLoading palette={palette} />
          </View>
        </AppPage>
      </RequireAgentAuth>
    );
  }

  if (error || !mission) {
    return (
      <RequireAgentAuth>
        <AppPage title={t('missions.reportTitle')} topBarMode="back" backHref={params.id ? `/missions/${params.id}` : '/(tabs)/explore'}>
          <AppStateCard
            palette={palette}
            icon="cloud-offline-outline"
            title={t('missions.loadingErrorTitle')}
            description={error || t('missions.notFoundDescription')}
            tone="danger"
          />
        </AppPage>
      </RequireAgentAuth>
    );
  }

  if (permission && !permission.granted) {
    return (
      <RequireAgentAuth>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}> 
          <View style={styles.centerState}>
            <View style={[styles.permissionIcon, { backgroundColor: palette.accentSoft }]}> 
              <Ionicons name="camera-outline" size={28} color={palette.primary} />
            </View>
            <Text style={[styles.stateTitle, { color: palette.headline }]}>{t('missions.enableCameraTitle')}</Text>
            <Pressable onPress={() => void requestPermission()} style={[styles.primaryButton, { backgroundColor: palette.primary }]}> 
              <Text style={styles.primaryButtonLabel}>{t('missions.enableCameraAction')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </RequireAgentAuth>
    );
  }

  if (!permission) {
    return (
      <RequireAgentAuth>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}> 
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={[styles.stateTitle, { color: palette.headline }]}>{t('missions.cameraPreparingTitle')}</Text>
          </View>
        </SafeAreaView>
      </RequireAgentAuth>
    );
  }

  if (step === 'form' && capturedPhoto) {
    return (
      <RequireAgentAuth>
        <AppPage
          title={t('missions.reportTitle')}
          topBarMode="back"
          backHref={`/missions/${mission.id}`}
          onBackPress={() => setStep('capture')}>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
            <View style={styles.compactHero}>
              <Image source={{ uri: capturedPhoto.uri }} style={styles.thumbnail} contentFit="cover" alt="" />
              <View style={styles.compactHeroBody}>
                <Text style={[styles.compactHeroTitle, { color: palette.headline }]}>{mission.title}</Text>
                <Text style={[styles.compactHeroText, { color: palette.muted }]}>
                  {mission.meter.serialNumber} · {mission.client.name}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
            <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('missions.fieldOutcome')}</Text>
            <Pressable
              onPress={() => setShowOutcomeSelect(true)}
              style={[styles.selectButton, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
              <Text style={[styles.selectButtonText, { color: palette.headline }]}>{selectedResolutionLabel}</Text>
              <Ionicons name="chevron-down" size={18} color={palette.icon} />
            </Pressable>

            <View style={styles.formStack}>
              <AuthInput
                label={t('missions.fieldComment')}
                icon="chatbubble-ellipses-outline"
                value={comment}
                onChangeText={setComment}
                placeholder={t('missions.commentPlaceholder')}
              />

              {requiresIndexes ? (
                <>
                  <AuthInput
                    label={t('missions.fieldPrimaryIndex')}
                    icon="flash-outline"
                    keyboardType="numeric"
                    value={primaryIndex}
                    onChangeText={setPrimaryIndex}
                    placeholder="1254"
                  />

                  {mission.meter.type === 'DUAL_INDEX' ? (
                    <AuthInput
                      label={t('missions.fieldSecondaryIndex')}
                      icon="layers-outline"
                      keyboardType="numeric"
                      value={secondaryIndex}
                      onChangeText={setSecondaryIndex}
                      placeholder="874"
                    />
                  ) : null}
                </>
              ) : null}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
            <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('missions.fieldProof')}</Text>
            <Text style={[styles.metaText, { color: palette.muted }]}>
              {t('missions.fieldProofBody')}
            </Text>

            <View style={styles.infoRow}>
              <Ionicons name="locate-outline" size={16} color={palette.icon} />
              <Text style={[styles.infoText, { color: palette.muted }]}>
                {formatGpsSummary(capturedPhoto, locale)}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => void handleSubmit()}
            disabled={isSubmitting}
            style={[styles.submitButton, { backgroundColor: isSubmitting ? `${palette.primary}99` : palette.primary }]}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#ffffff" />
                <Text style={styles.submitButtonText}>{t('missions.submitResult')}</Text>
              </>
            )}
          </Pressable>

          <Modal visible={showOutcomeSelect} transparent animationType="fade" onRequestClose={() => setShowOutcomeSelect(false)}>
            <View style={styles.modalBackdrop}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowOutcomeSelect(false)} />
              <View style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: palette.headline }]}>{t('missions.selectOutcomeTitle')}</Text>
                  <Pressable onPress={() => setShowOutcomeSelect(false)} style={[styles.modalClose, { backgroundColor: palette.surfaceMuted }]}> 
                    <Ionicons name="close" size={18} color={palette.icon} />
                  </Pressable>
                </View>

                <View style={styles.modalOptions}>
                  {resolutionOptions.map((option) => {
                    const active = resolutionCode === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => {
                          setResolutionCode(option.value);
                          setShowOutcomeSelect(false);
                        }}
                        style={[
                          styles.modalOption,
                          {
                            backgroundColor: active ? palette.accentSoft : palette.surfaceMuted,
                            borderColor: active ? palette.accent : palette.border,
                          },
                        ]}>
                        <Text style={[styles.modalOptionText, { color: active ? palette.primary : palette.headline }]}>
                          {option.label}
                        </Text>
                        {active ? <Ionicons name="checkmark" size={18} color={palette.accent} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </Modal>
        </AppPage>
      </RequireAgentAuth>
    );
  }

  return (
    <RequireAgentAuth>
      <SafeAreaView style={styles.cameraScreen}>
        {step === 'preview' && capturedPhoto ? (
          <View style={styles.previewScreen}>
            <Image source={{ uri: capturedPhoto.uri }} style={styles.previewImage} contentFit="cover" alt="" />

            <View style={styles.previewOverlay}>
              <View style={styles.previewHeader}>
                <Pressable onPress={resetFlow} style={[styles.iconButton, { backgroundColor: 'rgba(7, 17, 31, 0.44)' }]}> 
                  <Ionicons name="arrow-back" size={22} color="#ffffff" />
                </Pressable>
              </View>

              <View style={styles.previewFooter}>
                <View style={styles.previewActions}>
                  <Pressable onPress={resetFlow} style={[styles.previewActionIconButton, { backgroundColor: 'rgba(255,255,255,0.12)' }]}> 
                    <Ionicons name="refresh-outline" size={24} color="#ffffff" />
                  </Pressable>

                  <Pressable onPress={() => setStep('form')} style={styles.previewActionIconButtonPrimary}>
                    <Ionicons name="arrow-forward" size={24} color="#08101f" />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

            <View style={styles.overlay}>
              <View style={styles.topBar}>
                <Pressable onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: 'rgba(7, 17, 31, 0.44)' }]}> 
                  <Ionicons name="arrow-back" size={24} color="#ffffff" />
                </Pressable>

                <View style={styles.headerTextBlock}>
                  <Text style={styles.headerEyebrow}>{t('missions.reportEyebrow')}</Text>
                  <Text style={styles.headerTitle}>{t('missions.reportCameraTitle')}</Text>
                </View>

                <View style={styles.iconButtonPlaceholder} />
              </View>

              <View style={styles.scanZoneWrapper}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTopLeft]} />
                  <View style={[styles.corner, styles.cornerTopRight]} />
                  <View style={[styles.corner, styles.cornerBottomLeft]} />
                  <View style={[styles.corner, styles.cornerBottomRight]} />
                  <View style={styles.scanLine} />
                </View>
              </View>

              <View style={styles.captureFooter}>
                <Pressable
                  onPress={() => void handleCapture()}
                  disabled={isCapturing || isSubmitting}
                  style={({ pressed }) => [
                    styles.captureButtonOuter,
                    pressed && styles.captureButtonOuterPressed,
                    (isCapturing || isSubmitting) && styles.captureButtonOuterDisabled,
                  ]}>
                  <View style={[styles.captureButtonInner, isCapturing && styles.captureButtonInnerDisabled]}>
                    {isCapturing ? (
                      <ActivityIndicator size="small" color="#08101f" />
                    ) : (
                      <Ionicons name="camera" size={28} color="#08101f" />
                    )}
                  </View>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </SafeAreaView>
    </RequireAgentAuth>
  );
}

async function getTaskLocationWithTimeout(): Promise<CapturedTaskPhotoLocation> {
  try {
    const location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);

    if (!location) {
      return { gpsLatitude: null, gpsLongitude: null, gpsAccuracyMeters: null };
    }

    return {
      gpsLatitude: location.coords.latitude,
      gpsLongitude: location.coords.longitude,
      gpsAccuracyMeters: location.coords.accuracy ?? null,
    };
  } catch {
    return { gpsLatitude: null, gpsLongitude: null, gpsAccuracyMeters: null };
  }
}

function toCaptureErrorMessage(error: unknown) {
  if (error instanceof Error) {
    switch (error.message) {
      case 'photo_missing':
        return 'La photo n a pas pu etre capturee. Reessaie.';
      default:
        return error.message;
    }
  }

  return 'Impossible de capturer la preuve terrain.';
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatGpsSummary(photo: CapturedTaskPhoto, locale: string) {
  const latitude = toFiniteNumber(photo.gpsLatitude);
  const longitude = toFiniteNumber(photo.gpsLongitude);

  if (latitude === null || longitude === null) {
    return '--';
  }

  const accuracy =
    photo.gpsAccuracyMeters !== null
      ? ` · ±${photo.gpsAccuracyMeters.toLocaleString(locale, { maximumFractionDigits: 0 })} m`
      : '';

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}${accuracy}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: '#040912',
  },
  centerWrap: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  permissionIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: 18,
    minHeight: 52,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  compactHero: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  compactHeroBody: {
    flex: 1,
    gap: 4,
  },
  compactHeroTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  compactHeroText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  selectButton: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  formStack: {
    gap: 14,
  },
  metaText: {
    fontSize: 14,
    lineHeight: 21,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  submitButton: {
    minHeight: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9, 14, 23, 0.44)',
  },
  modalCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptions: {
    gap: 10,
  },
  modalOption: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 52,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalOptionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  previewScreen: {
    flex: 1,
    backgroundColor: '#03080f',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  previewOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 26,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  previewFooter: {
    alignItems: 'center',
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  previewActionIconButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewActionIconButtonPrimary: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 26,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  headerEyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  scanZoneWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: '82%',
    aspectRatio: 0.82,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  corner: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: '#ffffff',
  },
  cornerTopLeft: {
    top: 18,
    left: 18,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 18,
  },
  cornerTopRight: {
    top: 18,
    right: 18,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 18,
  },
  cornerBottomLeft: {
    bottom: 18,
    left: 18,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 18,
  },
  cornerBottomRight: {
    bottom: 18,
    right: 18,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 18,
  },
  scanLine: {
    position: 'absolute',
    top: '42%',
    left: 26,
    right: 26,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  captureFooter: {
    alignItems: 'center',
  },
  captureButtonOuter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  captureButtonOuterPressed: {
    transform: [{ scale: 0.98 }],
  },
  captureButtonOuterDisabled: {
    opacity: 0.58,
  },
  captureButtonInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInnerDisabled: {
    backgroundColor: 'rgba(255,255,255,0.84)',
  },
});
