import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { AuthInput } from '@/components/auth/auth-input';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useSafePush } from '@/hooks/use-safe-push';
import { isMobileAuthError, toMobileErrorMessage } from '@/lib/api/mobile-client';
import { listClientMeters, type MobileMeter } from '@/lib/api/mobile-meters';
import { getMobileAppConfig } from '@/lib/api/mobile-app-config';
import { createClientReading, resubmitClientReading } from '@/lib/api/mobile-readings';
import { uploadReadingPhoto } from '@/lib/api/mobile-uploads';
import { useMobileDrawer } from '@/providers/mobile-drawer-provider';
import { useMobilePreferences } from '@/providers/mobile-preferences-provider';
import { useMobileSession } from '@/providers/mobile-session-provider';

type Step = 'capture' | 'preview' | 'details';

type CapturedReadingPhoto = {
  uri: string;
  capturedAt: string;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAccuracyMeters: number | null;
};

type CapturedReadingPhotoLocation = {
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAccuracyMeters: number | null;
};

export default function ReadingsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { t } = useI18n();
  const params = useLocalSearchParams<{ resubmitReadingId?: string; meterId?: string }>();
  const { openDrawer } = useMobileDrawer();
  const { preferences } = useMobilePreferences();
  const { session, logout } = useMobileSession();
  const { safePush } = useSafePush();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [step, setStep] = useState<Step>('capture');
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedReadingPhoto | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [meters, setMeters] = useState<MobileMeter[]>([]);
  const [loadingMeters, setLoadingMeters] = useState(true);
  const [metersError, setMetersError] = useState<string | null>(null);
  const [selectedMeterId, setSelectedMeterId] = useState<string | null>(null);
  const [primaryIndex, setPrimaryIndex] = useState('');
  const [secondaryIndex, setSecondaryIndex] = useState('');
  const [requireGpsForReading, setRequireGpsForReading] = useState(true);
  const [gpsThresholdMeters, setGpsThresholdMeters] = useState(200);
  const [maxImageSizeMb, setMaxImageSizeMb] = useState(8);
  const resubmitReadingId =
    typeof params.resubmitReadingId === 'string' ? params.resubmitReadingId : null;
  const forcedMeterId = typeof params.meterId === 'string' ? params.meterId : null;
  const isResubmissionFlow = Boolean(resubmitReadingId);

  const selectedMeter = meters.find((meter) => meter.id === selectedMeterId) ?? null;
  const isResubmissionMeterLocked =
    isResubmissionFlow && Boolean(forcedMeterId) && Boolean(selectedMeter);
  const selectableMeters = isResubmissionMeterLocked && selectedMeter ? [selectedMeter] : meters;
  const mobileGpsDistanceMeters =
    selectedMeter && capturedPhoto
      ? calculateGpsDistanceMeters(
          toNumberOrNull(selectedMeter.latitude),
          toNumberOrNull(selectedMeter.longitude),
          capturedPhoto.gpsLatitude,
          capturedPhoto.gpsLongitude
        )
      : null;
  const gpsDistanceWarning =
    mobileGpsDistanceMeters !== null && mobileGpsDistanceMeters > gpsThresholdMeters;

  const loadMeters = useCallback(
    async (activeRef: { current: boolean } = { current: true }) => {
      if (!session?.accessToken) {
        setLoadingMeters(false);
        return;
      }

      setLoadingMeters(true);
      setMetersError(null);

      try {
        const result = await listClientMeters(session.accessToken);
        if (!activeRef.current) return;
        setMeters(result.meters);
        setSelectedMeterId((current) => {
          if (current && result.meters.some((meter) => meter.id === current)) {
            return current;
          }
          if (forcedMeterId && result.meters.some((meter) => meter.id === forcedMeterId)) {
            return forcedMeterId;
          }
          return result.meters[0]?.id ?? null;
        });
      } catch (loadError) {
        if (!activeRef.current) return;
        const message = toMobileErrorMessage(loadError, t('readingsFlow.metersFallback'));
        setMetersError(message);
        if (isMobileAuthError(loadError)) {
          await logout();
        }
      } finally {
        if (activeRef.current) {
          setLoadingMeters(false);
        }
      }
    },
    [forcedMeterId, logout, session?.accessToken, t]
  );

  useEffect(() => {
    const activeRef = { current: true };
    void loadMeters(activeRef);

    return () => {
      activeRef.current = false;
    };
  }, [loadMeters]);

  useEffect(() => {
    let active = true;

    async function loadAppConfig() {
      try {
        const result = await getMobileAppConfig();
        if (!active) return;
        setRequireGpsForReading(result.config.requireGpsForReading);
        if (typeof result.config.maxGpsDistanceMeters === 'number' && result.config.maxGpsDistanceMeters > 0) {
          setGpsThresholdMeters(result.config.maxGpsDistanceMeters);
        }
        if (typeof result.config.maxImageSizeMb === 'number' && result.config.maxImageSizeMb > 0) {
          setMaxImageSizeMb(result.config.maxImageSizeMb);
        }
      } catch {
        if (!active) return;
      }
    }

    void loadAppConfig();

    return () => {
      active = false;
    };
  }, []);

  async function handleCapture() {
    if (!cameraRef.current || isCapturing) {
      return;
    }

    setIsCapturing(true);

    try {
      const locationPermission = await Location.requestForegroundPermissionsAsync();
      if (!locationPermission.granted && requireGpsForReading) {
        Alert.alert(
          t('readingsFlow.alert.positionRequiredTitle'),
          t('readingsFlow.alert.positionRequiredBody')
        );
        return;
      }

      const [photo, location] = await Promise.all([
        cameraRef.current.takePictureAsync({
          quality: 0.82,
          shutterSound: false,
        }),
        locationPermission.granted
          ? getReadingLocationWithTimeout()
          : Promise.resolve<CapturedReadingPhotoLocation>({
              gpsLatitude: null,
              gpsLongitude: null,
              gpsAccuracyMeters: null,
            }),
      ]);

      if (!photo?.uri) {
        throw new Error('photo_missing');
      }

      if (requireGpsForReading && (location.gpsLatitude === null || location.gpsLongitude === null)) {
        Alert.alert(
          t('readingsFlow.alert.positionUnavailableTitle'),
          t('readingsFlow.alert.positionUnavailableBody')
        );
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
      Alert.alert(
        t('readingsFlow.alert.captureFailedTitle'),
        toCaptureErrorMessage(captureError, requireGpsForReading, t)
      );
    } finally {
      setIsCapturing(false);
    }
  }

  async function handleSubmitReading() {
    if (isSubmitting || loadingMeters) {
      return;
    }

    if (!capturedPhoto) {
      Alert.alert(t('readingsFlow.alert.photoMissingTitle'), t('readingsFlow.alert.photoMissingBody'));
      return;
    }

    if (!selectedMeter) {
      Alert.alert(t('readingsFlow.alert.meterRequiredTitle'), t('readingsFlow.alert.meterRequiredBody'));
      return;
    }

    if (requireGpsForReading && (capturedPhoto.gpsLatitude === null || capturedPhoto.gpsLongitude === null)) {
      Alert.alert(
        t('readingsFlow.alert.positionRequiredTitle'),
        t('readingsFlow.alert.positionRequiredForSubmit')
      );
      return;
    }

    const primaryValue = Number(primaryIndex);
    const secondaryValue = Number(secondaryIndex);

    if (!Number.isFinite(primaryValue) || primaryValue < 0) {
      Alert.alert(t('readingsFlow.alert.invalidIndexTitle'), t('readingsFlow.alert.invalidPrimaryIndexBody'));
      return;
    }

    if (selectedMeter.type === 'DUAL_INDEX' && (!Number.isFinite(secondaryValue) || secondaryValue < 0)) {
      Alert.alert(
        t('readingsFlow.alert.secondaryIndexRequiredTitle'),
        t('readingsFlow.alert.secondaryIndexRequiredBody')
      );
      return;
    }

    if (gpsDistanceWarning) {
      const shouldContinue = await confirmGpsDistanceWarning(
        mobileGpsDistanceMeters ?? 0,
        gpsThresholdMeters,
        t
      );
      if (!shouldContinue) {
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const uploadedFile = await uploadReadingPhoto(capturedPhoto.uri, {
        maxSizeBytes: maxImageSizeMb * 1024 * 1024,
      });
      const readingPayload = {
        primaryIndex: primaryValue,
        ...(selectedMeter.type === 'DUAL_INDEX' ? { secondaryIndex: secondaryValue } : {}),
        imageUrl: uploadedFile.url,
        imageHash: uploadedFile.sha256,
        imageMimeType: uploadedFile.mimeType,
        imageSizeBytes: uploadedFile.sizeBytes,
        ...(capturedPhoto.gpsLatitude !== null ? { gpsLatitude: capturedPhoto.gpsLatitude } : {}),
        ...(capturedPhoto.gpsLongitude !== null ? { gpsLongitude: capturedPhoto.gpsLongitude } : {}),
        ...(capturedPhoto.gpsAccuracyMeters !== null
          ? { gpsAccuracyMeters: capturedPhoto.gpsAccuracyMeters }
          : {}),
        readingAt: capturedPhoto.capturedAt,
      };

      const result =
        isResubmissionFlow && resubmitReadingId
          ? await resubmitClientReading(resubmitReadingId, readingPayload)
          : await createClientReading({
              meterId: selectedMeter.id,
              ...readingPayload,
              idempotencyKey: `${selectedMeter.id}-${uploadedFile.sha256.slice(0, 16)}`,
            });

      Alert.alert(
        isResubmissionFlow
          ? t('readingsFlow.alert.resubmittedTitle')
          : t('readingsFlow.alert.submittedTitle'),
        isResubmissionFlow
          ? t('readingsFlow.alert.resubmittedBody', { meter: result.reading.meter.serialNumber })
          : t('readingsFlow.alert.submittedBody', { meter: result.reading.meter.serialNumber }),
        [
          {
            text: t('readingsFlow.alert.viewHistory'),
            onPress: () => {
              resetFlow();
              safePush('/readings-history');
            },
          },
          {
            text: isResubmissionFlow ? t('readingsFlow.alert.backToCamera') : t('readingsFlow.alert.backHome'),
            onPress: () => {
              resetFlow();
              if (isResubmissionFlow) {
                router.replace('/(tabs)/readings');
                return;
              }

              router.replace('/(tabs)');
            },
          },
        ]
      );
    } catch (submitError) {
      if (isMobileAuthError(submitError)) {
        await logout();
      }
      Alert.alert(
        t('readingsFlow.alert.submitFailedTitle'),
        toMobileErrorMessage(
          submitError,
          t('readingsFlow.alert.submitFailedBody')
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetFlow() {
    setStep('capture');
    setCapturedPhoto(null);
    setPrimaryIndex('');
    setSecondaryIndex('');
    setShowHelp(false);
  }

  if (!permission) {
    return (
      <RequireMobileAuth>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={[styles.stateTitle, { color: palette.headline }]}>{t('readingsFlow.permission.preparingTitle')}</Text>
            <Text style={[styles.stateText, { color: palette.muted }]}>
              {t('readingsFlow.permission.preparingBody')}
            </Text>
          </View>
        </SafeAreaView>
      </RequireMobileAuth>
    );
  }

  if (!permission.granted) {
    return (
      <RequireMobileAuth>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
          <View style={styles.centerState}>
            <View style={[styles.permissionIcon, { backgroundColor: palette.accentSoft }]}>
              <Ionicons name="camera-outline" size={28} color={palette.primary} />
            </View>
            <Text style={[styles.stateTitle, { color: palette.headline }]}>{t('readingsFlow.permission.enableTitle')}</Text>
            <Text style={[styles.stateText, { color: palette.muted }]}>
              {t('readingsFlow.permission.enableBody')}
            </Text>

            <Pressable
              onPress={() => void requestPermission()}
              style={[styles.primaryButton, { backgroundColor: palette.primary }]}>
              <Text style={styles.primaryButtonLabel}>{t('readingsFlow.permission.enableAction')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </RequireMobileAuth>
    );
  }

  if (step === 'details' && capturedPhoto) {
    return (
      <RequireMobileAuth>
        <AppPage
          title={isResubmissionFlow ? t('readingsFlow.details.resubmitTitle') : t('readingsFlow.details.title')}
          subtitle={isResubmissionFlow ? t('readingsFlow.details.resubmitSubtitle') : t('readingsFlow.details.subtitle')}
          topBarMode="back"
          onBackPress={() => setStep('capture')}
          contentStyle={styles.detailsContainer}>
          <View style={[styles.detailsCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.compactHero}>
              <Image source={{ uri: capturedPhoto.uri }} style={styles.thumbnail} contentFit="cover" alt="" />

              <View style={styles.compactHeroBody}>
                <Text style={[styles.compactHeroTitle, { color: palette.headline }]}>
                  {isResubmissionFlow ? t('readingsFlow.details.photoReadyResubmit') : t('readingsFlow.details.photoReady')}
                </Text>
                <Text style={[styles.compactHeroText, { color: palette.muted }]}>
                  {isResubmissionFlow
                    ? t('readingsFlow.details.photoReadyResubmitBody')
                    : t('readingsFlow.details.photoReadyBody')}
                </Text>

                {selectedMeter ? (
                  <View style={[styles.selectedMeterBadge, { backgroundColor: palette.accentSoft }]}>
                    <Ionicons name="flash-outline" size={14} color={palette.accent} />
                    <Text style={[styles.selectedMeterBadgeText, { color: palette.primary }]}>
                      {selectedMeter.serialNumber}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={[styles.detailsCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('common.meter')}</Text>

            {loadingMeters ? (
              <View style={styles.inlineState}>
                <CircularLoading palette={palette} size={52} />
              </View>
            ) : metersError ? (
              <View style={styles.inlineStateError}>
                <Text style={[styles.inlineErrorText, { color: palette.danger }]}>{metersError}</Text>
                <Pressable
                  onPress={() => void loadMeters()}
                  style={[styles.inlineRetryButton, { backgroundColor: palette.accentSoft }]}>
                  <Ionicons name="refresh-outline" size={15} color={palette.accent} />
                  <Text style={[styles.inlineRetryButtonText, { color: palette.primary }]}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.metersStack}>
                {selectableMeters.map((meter) => {
                  const selected = selectedMeterId === meter.id;

                  return (
                    <Pressable
                      key={meter.id}
                      disabled={isResubmissionMeterLocked || isSubmitting}
                      onPress={() => setSelectedMeterId(meter.id)}
                      style={[
                        styles.meterChoice,
                        {
                          backgroundColor: selected ? palette.accentSoft : palette.surfaceMuted,
                          borderColor: selected ? palette.accent : palette.border,
                        },
                      ]}>
                      <View
                        style={[
                          styles.meterChoiceIcon,
                          { backgroundColor: selected ? '#ffffff' : palette.surface },
                        ]}>
                        <Ionicons
                          name={meter.type === 'DUAL_INDEX' ? 'layers-outline' : 'flash-outline'}
                          size={18}
                          color={selected ? palette.accent : palette.icon}
                        />
                      </View>

                      <View style={styles.meterChoiceBody}>
                        <Text style={[styles.meterChoiceTitle, { color: palette.headline }]}>
                          {meter.serialNumber}
                        </Text>
                        <Text style={[styles.meterChoiceMeta, { color: palette.muted }]}>
                          {[meter.city, meter.zone].filter(Boolean).join(' / ') || t('meters.locationMissing')}
                        </Text>
                      </View>

                      <View style={styles.meterChoiceAside}>
                        <Text style={[styles.meterChoiceType, { color: selected ? palette.primary : palette.muted }]}>
                          {meter.type === 'DUAL_INDEX' ? t('readingsFlow.meterType.dual') : t('readingsFlow.meterType.single')}
                        </Text>
                        {selected ? <Ionicons name="checkmark-circle" size={20} color={palette.accent} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {selectedMeter ? (
            <View
              style={[
                styles.gpsCard,
                {
                  backgroundColor: gpsDistanceWarning ? '#fff4e8' : palette.surface,
                  borderColor: gpsDistanceWarning ? '#f3c98b' : palette.border,
                },
              ]}>
              <View style={styles.gpsCardHeader}>
                <View
                  style={[
                    styles.gpsCardIcon,
                    {
                      backgroundColor: gpsDistanceWarning ? 'rgba(255,255,255,0.72)' : palette.accentSoft,
                    },
                  ]}>
                  <Ionicons
                    name={gpsDistanceWarning ? 'warning-outline' : 'locate-outline'}
                    size={18}
                    color={gpsDistanceWarning ? '#c77c11' : palette.accent}
                  />
                </View>

                <View style={styles.gpsCardBody}>
                  <Text style={[styles.gpsCardTitle, { color: palette.headline }]}>
                    {t('readingsFlow.gps.title')}
                  </Text>
                  <Text
                    style={[
                      styles.gpsCardMeta,
                      { color: gpsDistanceWarning ? '#9a6514' : palette.muted },
                    ]}>
                    {mobileGpsDistanceMeters !== null
                      ? t('readingsFlow.gps.distanceFromMeter', { value: formatMeters(mobileGpsDistanceMeters) })
                      : t('readingsFlow.gps.coordinatesMissing')}
                  </Text>
                </View>
              </View>

              {mobileGpsDistanceMeters !== null ? (
                <Text
                  style={[
                    styles.gpsCardHint,
                    { color: gpsDistanceWarning ? '#9a6514' : palette.muted },
                ]}>
                {gpsDistanceWarning
                    ? t('readingsFlow.gps.aboveThreshold', { threshold: gpsThresholdMeters })
                    : t('readingsFlow.gps.withinThreshold', { threshold: gpsThresholdMeters })}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.detailsCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.indexHeader}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('common.index')}</Text>
              {selectedMeter ? (
                <Text style={[styles.indexHeaderHint, { color: palette.muted }]}>
                  {selectedMeter.type === 'DUAL_INDEX' ? t('readingsFlow.index.dualRequired') : t('readingsFlow.index.singleRequired')}
                </Text>
              ) : null}
            </View>

            <View style={styles.indexStack}>
              <AuthInput
                label={t('home.primaryIndex')}
                icon="flash-outline"
                keyboardType="numeric"
                value={primaryIndex}
                onChangeText={setPrimaryIndex}
                placeholder={t('readingsFlow.index.primaryPlaceholder')}
              />

              {selectedMeter?.type === 'DUAL_INDEX' ? (
                <AuthInput
                  label={t('home.secondaryIndex')}
                  icon="layers-outline"
                  keyboardType="numeric"
                  value={secondaryIndex}
                  onChangeText={setSecondaryIndex}
                  placeholder={t('readingsFlow.index.secondaryPlaceholder')}
                />
              ) : null}
            </View>

            <Pressable
              onPress={() => void handleSubmitReading()}
              disabled={isSubmitting}
              style={[
                styles.submitButton,
                {
                  backgroundColor: isSubmitting ? `${palette.primary}99` : palette.primary,
                },
              ]}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color="#ffffff" />
                  <Text style={styles.submitButtonText}>
                    {isResubmissionFlow ? t('readingsFlow.details.resubmitCta') : t('readingsFlow.details.submitCta')}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </AppPage>
      </RequireMobileAuth>
    );
  }

  return (
    <RequireMobileAuth>
      <SafeAreaView style={styles.cameraScreen}>
        {step === 'preview' && capturedPhoto ? (
          <View style={styles.previewScreen}>
            <Image source={{ uri: capturedPhoto.uri }} style={styles.previewImage} contentFit="cover" alt="" />

            <View style={styles.previewOverlay}>
              <View style={styles.previewHeader}>
                <Pressable
                  disabled={isCapturing}
                  onPress={resetFlow}
                  style={[styles.iconButton, { backgroundColor: 'rgba(7, 17, 31, 0.44)' }]}>
                  <Ionicons name="arrow-back" size={22} color="#ffffff" />
                </Pressable>
              </View>

              <View style={styles.previewFooter}>
                <View style={styles.previewActions}>
                  <Pressable
                    disabled={isCapturing}
                    onPress={resetFlow}
                    style={[
                      styles.previewActionIconButton,
                      {
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        opacity: isCapturing ? 0.55 : 1,
                      },
                    ]}>
                    <Ionicons name="refresh-outline" size={24} color="#ffffff" />
                  </Pressable>

                  <Pressable
                    disabled={isCapturing}
                    onPress={() => setStep('details')}
                    style={[
                      styles.previewActionIconButtonPrimary,
                      { opacity: isCapturing ? 0.55 : 1 },
                    ]}>
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
                <Pressable
                  onPress={isResubmissionFlow ? () => router.back() : openDrawer}
                  style={[styles.iconButton, { backgroundColor: 'rgba(7, 17, 31, 0.44)' }]}>
                  <Ionicons
                    name={isResubmissionFlow ? 'arrow-back' : 'menu-outline'}
                    size={24}
                    color="#ffffff"
                  />
                </Pressable>

                <View style={styles.headerTextBlock}>
                  <Text style={styles.headerEyebrow}>
                    {isResubmissionFlow ? t('readingsFlow.capture.resubmissionEyebrow') : t('readingsFlow.capture.eyebrow')}
                  </Text>
                  <Text style={styles.headerTitle}>
                    {isResubmissionFlow ? t('readingsFlow.capture.resubmissionTitle') : t('readingsFlow.capture.title')}
                  </Text>
                </View>

                {preferences.showCameraHelp ? (
                  <Pressable
                    onPress={() => setShowHelp(true)}
                    style={[styles.iconButton, { backgroundColor: 'rgba(7, 17, 31, 0.44)' }]}>
                    <Ionicons name="information-circle-outline" size={22} color="#ffffff" />
                  </Pressable>
                ) : (
                  <View style={styles.iconButtonPlaceholder} />
                )}
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
                  <View
                    style={[
                      styles.captureButtonInner,
                      isCapturing && styles.captureButtonInnerDisabled,
                    ]}>
                    {isCapturing ? (
                      <ActivityIndicator size="small" color="#08101f" />
                    ) : (
                      <Ionicons name="camera" size={28} color="#08101f" />
                    )}
                  </View>
                </Pressable>
              </View>
            </View>

            <Modal
              visible={showHelp}
              transparent
              animationType="fade"
              onRequestClose={() => setShowHelp(false)}>
              <View style={styles.helpBackdrop}>
                <View style={styles.helpCard}>
                  <View style={styles.helpHeader}>
                    <Text style={styles.helpTitle}>{t('readingsFlow.help.title')}</Text>
                    <Pressable onPress={() => setShowHelp(false)} style={styles.helpCloseButton}>
                      <Ionicons name="close" size={20} color="#ffffff" />
                    </Pressable>
                  </View>

                  <View style={styles.helpList}>
                    <Text style={styles.helpItem}>{t('readingsFlow.help.itemFrame')}</Text>
                    <Text style={styles.helpItem}>{t('readingsFlow.help.itemBlur')}</Text>
                    <Text style={styles.helpItem}>{t('readingsFlow.help.itemGps')}</Text>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        )}
      </SafeAreaView>
    </RequireMobileAuth>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: '#020817',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stateTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  primaryButton: {
    marginTop: 16,
    minWidth: 220,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: 'rgba(3, 8, 19, 0.26)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  headerTextBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
  },
  headerEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  scanZoneWrapper: {
    alignItems: 'center',
    gap: 12,
  },
  scanFrame: {
    width: '88%',
    maxWidth: 360,
    aspectRatio: 0.86,
    borderRadius: 30,
    backgroundColor: 'rgba(7, 17, 31, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: '#9ec5ff',
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
    top: '50%',
    left: 22,
    right: 22,
    height: 2,
    backgroundColor: 'rgba(158, 197, 255, 0.96)',
    shadowColor: '#9ec5ff',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  captureFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  captureButtonOuter: {
    width: 94,
    height: 94,
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  captureButtonOuterPressed: {
    transform: [{ scale: 0.96 }],
  },
  captureButtonOuterDisabled: {
    opacity: 0.72,
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
    opacity: 0.7,
  },
  previewScreen: {
    flex: 1,
    backgroundColor: '#020817',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  previewOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: 'rgba(3, 8, 19, 0.28)',
  },
  previewHeader: {
    alignItems: 'flex-start',
  },
  previewFooter: {
    backgroundColor: 'transparent',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  previewActionIconButton: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewActionIconButtonPrimary: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d9e6ff',
  },
  helpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 23, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  helpCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: 'rgba(8, 16, 31, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  helpTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  helpCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  helpList: {
    gap: 10,
  },
  helpItem: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 21,
  },
  detailsContainer: {
    paddingBottom: 12,
    gap: 18,
  },
  detailsCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  gpsCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 10,
  },
  gpsCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  gpsCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsCardBody: {
    flex: 1,
    gap: 4,
  },
  gpsCardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  gpsCardMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  gpsCardHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  compactHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: 20,
  },
  compactHeroBody: {
    flex: 1,
    gap: 8,
  },
  compactHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  compactHeroText: {
    fontSize: 13,
    lineHeight: 19,
  },
  selectedMeterBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  selectedMeterBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  inlineState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineStateError: {
    gap: 12,
  },
  inlineStateText: {
    fontSize: 14,
    lineHeight: 20,
  },
  inlineErrorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  inlineRetryButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineRetryButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  metersStack: {
    gap: 10,
  },
  meterChoice: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  meterChoiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meterChoiceBody: {
    flex: 1,
    gap: 4,
  },
  meterChoiceTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  meterChoiceMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  meterChoiceAside: {
    alignItems: 'flex-end',
    gap: 6,
  },
  meterChoiceType: {
    fontSize: 12,
    fontWeight: '700',
  },
  indexHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  indexHeaderHint: {
    fontSize: 12,
    fontWeight: '700',
  },
  indexStack: {
    gap: 14,
  },
  submitButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});

function toNumberOrNull(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function calculateGpsDistanceMeters(
  meterLat: number | null,
  meterLng: number | null,
  readLat: number | null,
  readLng: number | null
) {
  if (meterLat === null || meterLng === null || readLat === null || readLng === null) return null;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(readLat - meterLat);
  const dLon = toRad(readLng - meterLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(meterLat)) * Math.cos(toRad(readLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

function formatMeters(value: number) {
  return `${Math.round(value)} m`;
}

async function getReadingLocationWithTimeout(): Promise<CapturedReadingPhotoLocation> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('gps_timeout')), 8000);
  });

  const position = await Promise.race([
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }),
    timeoutPromise,
  ]);

  return {
    gpsLatitude: position.coords.latitude,
    gpsLongitude: position.coords.longitude,
    gpsAccuracyMeters:
      typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null,
  };
}

function toCaptureErrorMessage(
  error: unknown,
  requireGpsForReading: boolean,
  t: (key: string) => string
) {
  if (error instanceof Error) {
    switch (error.message) {
      case 'photo_missing':
        return t('readingsFlow.captureError.photoMissing');
      case 'gps_timeout':
        return requireGpsForReading
          ? t('readingsFlow.captureError.gpsTimeoutRequired')
          : t('readingsFlow.captureError.gpsTimeoutOptional');
      default:
        return requireGpsForReading
          ? t('readingsFlow.captureError.genericRequired')
          : t('readingsFlow.captureError.generic');
    }
  }

  return requireGpsForReading
    ? t('readingsFlow.captureError.genericRequired')
    : t('readingsFlow.captureError.generic');
}

function confirmGpsDistanceWarning(
  distanceMeters: number,
  thresholdMeters: number,
  t: (key: string, params?: Record<string, string | number | boolean>) => string
) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      t('readingsFlow.gps.warningTitle'),
      t('readingsFlow.gps.warningBody', {
        distance: formatMeters(distanceMeters),
        threshold: thresholdMeters,
      }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: t('common.continue'),
          onPress: () => resolve(true),
        },
      ]
    );
  });
}
