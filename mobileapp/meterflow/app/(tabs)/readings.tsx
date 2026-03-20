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
        const message = toMobileErrorMessage(loadError, 'Impossible de charger les compteurs.');
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
    [forcedMeterId, logout, session?.accessToken]
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
          'Position requise',
          'Autorise la localisation pour joindre les coordonnées GPS au relevé avant de continuer.'
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
          'Position indisponible',
          'Nous n’avons pas pu récupérer votre position. Active la localisation puis réessaie.'
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
        'Capture impossible',
        toCaptureErrorMessage(captureError, requireGpsForReading)
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
      Alert.alert('Photo manquante', 'Commence par capturer une photo du compteur.');
      return;
    }

    if (!selectedMeter) {
      Alert.alert('Compteur requis', 'Choisis le compteur concerné.');
      return;
    }

    if (requireGpsForReading && (capturedPhoto.gpsLatitude === null || capturedPhoto.gpsLongitude === null)) {
      Alert.alert(
        'Position requise',
        'La localisation est nécessaire pour transmettre ce relevé. Reprends la photo après avoir activé la position.'
      );
      return;
    }

    const primaryValue = Number(primaryIndex);
    const secondaryValue = Number(secondaryIndex);

    if (!Number.isFinite(primaryValue) || primaryValue < 0) {
      Alert.alert('Index invalide', "Saisis un index principal valide.");
      return;
    }

    if (selectedMeter.type === 'DUAL_INDEX' && (!Number.isFinite(secondaryValue) || secondaryValue < 0)) {
      Alert.alert('Index secondaire requis', "Ce compteur demande aussi un index secondaire.");
      return;
    }

    if (gpsDistanceWarning) {
      const shouldContinue = await confirmGpsDistanceWarning(
        mobileGpsDistanceMeters ?? 0,
        gpsThresholdMeters
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
        isResubmissionFlow ? 'Relevé renvoyé' : 'Relevé transmis',
        isResubmissionFlow
          ? `Le relevé du compteur ${result.reading.meter.serialNumber} a bien été renvoyé pour validation.`
          : `Le relevé du compteur ${result.reading.meter.serialNumber} a bien été transmis et sera vérifié par un agent.`,
        [
          {
            text: 'Voir mes relevés',
            onPress: () => {
              resetFlow();
              safePush('/readings-history');
            },
          },
          {
            text: isResubmissionFlow ? 'Retour caméra' : "Retour à l'accueil",
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
        'Envoi impossible',
        toMobileErrorMessage(
          submitError,
          "Le relevé n'a pas pu être envoyé. Vérifie ta connexion puis réessaie."
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
            <Text style={[styles.stateTitle, { color: palette.headline }]}>Préparation de la caméra</Text>
            <Text style={[styles.stateText, { color: palette.muted }]}>
              Nous vérifions les permissions nécessaires.
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
            <Text style={[styles.stateTitle, { color: palette.headline }]}>Activer la caméra</Text>
            <Text style={[styles.stateText, { color: palette.muted }]}>
              Le relevé commence par une photo nette du compteur et la récupération du GPS.
            </Text>

            <Pressable
              onPress={() => void requestPermission()}
              style={[styles.primaryButton, { backgroundColor: palette.primary }]}>
              <Text style={styles.primaryButtonLabel}>Autoriser la caméra</Text>
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
          title={isResubmissionFlow ? 'Renvoyer le relevé' : 'Finaliser le relevé'}
          subtitle={isResubmissionFlow ? 'Nouvelle photo et index' : 'Compteur et index'}
          topBarMode="back"
          onBackPress={() => setStep('capture')}
          contentStyle={styles.detailsContainer}>
          <View style={[styles.detailsCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.compactHero}>
              <Image source={{ uri: capturedPhoto.uri }} style={styles.thumbnail} contentFit="cover" alt="" />

              <View style={styles.compactHeroBody}>
                <Text style={[styles.compactHeroTitle, { color: palette.headline }]}>
                  {isResubmissionFlow ? 'Nouvelle photo prête' : 'Photo validée'}
                </Text>
                <Text style={[styles.compactHeroText, { color: palette.muted }]}>
                  {isResubmissionFlow
                    ? 'Reprenez les index du même compteur puis renvoyez le relevé.'
                    : 'Choisis maintenant le compteur concerné et renseigne ses index.'}
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
            <Text style={[styles.sectionTitle, { color: palette.headline }]}>Compteur</Text>

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
                  <Text style={[styles.inlineRetryButtonText, { color: palette.primary }]}>Réessayer</Text>
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
                          {[meter.city, meter.zone].filter(Boolean).join(' / ') || 'Localisation non renseignée'}
                        </Text>
                      </View>

                      <View style={styles.meterChoiceAside}>
                        <Text style={[styles.meterChoiceType, { color: selected ? palette.primary : palette.muted }]}>
                          {meter.type === 'DUAL_INDEX' ? 'Double' : 'Simple'}
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
                    Vérification GPS
                  </Text>
                  <Text
                    style={[
                      styles.gpsCardMeta,
                      { color: gpsDistanceWarning ? '#9a6514' : palette.muted },
                    ]}>
                    {mobileGpsDistanceMeters !== null
                      ? `${formatMeters(mobileGpsDistanceMeters)} du compteur enregistré`
                      : 'Coordonnées du compteur indisponibles. Le contrôle se fera côté serveur.'}
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
                    ? `Vous êtes au-delà du seuil recommandé (${gpsThresholdMeters} m). Le relevé peut être envoyé, mais il sera signalé pour contrôle.`
                    : `Position cohérente avec le compteur enregistré (seuil ${gpsThresholdMeters} m).`}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.detailsCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.indexHeader}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>Index</Text>
              {selectedMeter ? (
                <Text style={[styles.indexHeaderHint, { color: palette.muted }]}>
                  {selectedMeter.type === 'DUAL_INDEX' ? '2 champs requis' : '1 champ requis'}
                </Text>
              ) : null}
            </View>

            <View style={styles.indexStack}>
              <AuthInput
                label="Index principal"
                icon="flash-outline"
                keyboardType="numeric"
                value={primaryIndex}
                onChangeText={setPrimaryIndex}
                placeholder="Ex: 1254"
              />

              {selectedMeter?.type === 'DUAL_INDEX' ? (
                <AuthInput
                  label="Index secondaire"
                  icon="layers-outline"
                  keyboardType="numeric"
                  value={secondaryIndex}
                  onChangeText={setSecondaryIndex}
                  placeholder="Ex: 874"
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
                    {isResubmissionFlow ? 'Renvoyer le relevé' : 'Envoyer le relevé'}
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
                    {isResubmissionFlow ? 'Nouvelle soumission' : 'Relevé compteur'}
                  </Text>
                  <Text style={styles.headerTitle}>
                    {isResubmissionFlow ? 'Refais une photo nette' : 'Prends une photo nette'}
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
                    <Text style={styles.helpTitle}>Conseils rapides</Text>
                    <Pressable onPress={() => setShowHelp(false)} style={styles.helpCloseButton}>
                      <Ionicons name="close" size={20} color="#ffffff" />
                    </Pressable>
                  </View>

                  <View style={styles.helpList}>
                    <Text style={styles.helpItem}>Place le compteur dans le cadre.</Text>
                    <Text style={styles.helpItem}>Évite le flou et les reflets.</Text>
                    <Text style={styles.helpItem}>Autorise la localisation pour joindre les coordonnées GPS.</Text>
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

function toCaptureErrorMessage(error: unknown, requireGpsForReading: boolean) {
  if (error instanceof Error) {
    switch (error.message) {
      case 'photo_missing':
        return 'La photo du compteur n’a pas pu être récupérée. Reprends la capture.';
      case 'gps_timeout':
        return requireGpsForReading
          ? 'La position met trop de temps à se charger. Vérifie le GPS puis réessaie.'
          : 'La photo a bien été lancée, mais la position n’a pas répondu à temps.';
      default:
        return requireGpsForReading
          ? 'Nous n’avons pas pu prendre la photo du compteur avec une position valide.'
          : 'Nous n’avons pas pu prendre la photo du compteur.';
    }
  }

  return requireGpsForReading
    ? 'Nous n’avons pas pu prendre la photo du compteur avec une position valide.'
    : 'Nous n’avons pas pu prendre la photo du compteur.';
}

function confirmGpsDistanceWarning(distanceMeters: number, thresholdMeters: number) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      'Emplacement à vérifier',
      `La photo semble avoir été prise à environ ${formatMeters(distanceMeters)} du compteur enregistré, au-delà du seuil recommandé (${thresholdMeters} m). Voulez-vous continuer ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Continuer',
          onPress: () => resolve(true),
        },
      ]
    );
  });
}
