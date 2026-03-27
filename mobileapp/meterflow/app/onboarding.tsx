import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { AppShell } from '@/components/app/app-shell';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { setOnboardingCompleted } from '@/lib/storage/onboarding';

type Slide = {
  id: string;
  image: string;
  tint: string;
  glow: string;
};

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    image:
      'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&w=1200',
    tint: '#eef6ff',
    glow: '#dcefff',
  },
  {
    id: 'capture',
    image:
      'https://images.pexels.com/photos/3183198/pexels-photo-3183198.jpeg?auto=compress&cs=tinysrgb&w=1200',
    tint: '#fff8ef',
    glow: '#ffe8c4',
  },
  {
    id: 'followup',
    image:
      'https://images.pexels.com/photos/4050315/pexels-photo-4050315.jpeg?auto=compress&cs=tinysrgb&w=1200',
    tint: '#f6f1ff',
    glow: '#e3d6ff',
  },
  {
    id: 'ready',
    image:
      'https://images.pexels.com/photos/9875441/pexels-photo-9875441.jpeg?auto=compress&cs=tinysrgb&w=1200',
    tint: '#f3fff5',
    glow: '#d8ffe0',
  },
];

export default function OnboardingScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { t } = useI18n();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const horizontalPadding = 24;
  const cardWidth = Math.min(width - horizontalPadding * 2, 360);
  const compactScreen = height < 760;
  const tallScreen = height > 900;
  const imageHeight = compactScreen ? 240 : tallScreen ? 360 : 310;
  const titleSize = compactScreen ? 24 : 28;
  const titleLineHeight = compactScreen ? 28 : 32;
  const descriptionSize = compactScreen ? 14 : 15;
  const cardVerticalPadding = compactScreen ? 14 : 18;
  const isLast = currentIndex === SLIDES.length - 1;

  function goToSlide(index: number) {
    const safeIndex = Math.max(0, Math.min(index, SLIDES.length - 1));
    scrollRef.current?.scrollTo({ x: safeIndex * width, animated: true });
    setCurrentIndex(safeIndex);
  }

  function onMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(Math.max(0, Math.min(nextIndex, SLIDES.length - 1)));
  }

  async function finishOnboarding() {
    await setOnboardingCompleted();
    router.replace('/(auth)/login');
  }

  function handleNext() {
    if (isLast) {
      void finishOnboarding();
      return;
    }

    goToSlide(currentIndex + 1);
  }

  function handleSkip() {
    void finishOnboarding();
  }

  const activeSlide = SLIDES[currentIndex];

  return (
    <AppShell>
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <View style={styles.backgroundLayer}>
          <View style={[styles.blurCircle, styles.blurLeft, { backgroundColor: activeSlide.glow }]} />
          <View style={[styles.blurCircle, styles.blurRight, { backgroundColor: `${palette.accent}22` }]} />
        </View>

        <View style={styles.topRow}>
          <Text style={[styles.progressText, { color: palette.muted }]}>
            {currentIndex + 1}/{SLIDES.length}
          </Text>

          {!isLast ? (
            <Pressable onPress={handleSkip} hitSlop={12}>
              <Text style={[styles.skipText, { color: palette.headline }]}>{t('onboarding.skip')}</Text>
            </Pressable>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          onMomentumScrollEnd={onMomentumScrollEnd}
          contentContainerStyle={styles.slidesTrack}>
          {SLIDES.map((slide) => (
            <View key={slide.id} style={[styles.page, { width, minHeight: height * 0.78 }]}>
              <View
                style={[
                  styles.card,
                  {
                    width: cardWidth,
                    backgroundColor: palette.surface,
                    padding: cardVerticalPadding,
                    borderColor: palette.border,
                  },
                ]}>
                <View
                  style={[
                    styles.imageWrap,
                    {
                      backgroundColor: slide.tint,
                      height: imageHeight,
                    },
                  ]}>
                  <Image
                    source={{ uri: slide.image }}
                    style={styles.image}
                    contentFit="cover"
                    transition={180}
                    alt=""
                  />
                </View>

                <View style={styles.cardBody}>
                  <Text
                    style={[
                      styles.title,
                      {
                        color: palette.headline,
                        fontSize: titleSize,
                        lineHeight: titleLineHeight,
                      },
                    ]}>
                    {t(`onboarding.${slide.id}.title`)}
                  </Text>
                  <Text
                    style={[
                      styles.description,
                      {
                        color: palette.muted,
                        fontSize: descriptionSize,
                      },
                    ]}>
                    {t(`onboarding.${slide.id}.description`)}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.pagination}>
                    {SLIDES.map((dotSlide, index) => (
                      <View
                        key={dotSlide.id}
                        style={[
                          styles.dot,
                          {
                            width: index === currentIndex ? 22 : 7,
                            backgroundColor:
                              index === currentIndex ? palette.primary : palette.border,
                          },
                        ]}
                      />
                    ))}
                  </View>

                  <Pressable
                    onPress={handleNext}
                    style={[styles.nextButton, { backgroundColor: palette.headline }]}>
                    <Text style={styles.nextButtonText}>
                      {isLast ? t('onboarding.finish') : t('onboarding.next')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blurCircle: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    opacity: 0.55,
  },
  blurLeft: {
    top: 96,
    left: -88,
  },
  blurRight: {
    right: -96,
    bottom: 128,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  skipPlaceholder: {
    width: 40,
  },
  slidesTrack: {
    alignItems: 'center',
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  card: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 8,
  },
  imageWrap: {
    height: 330,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 24,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cardBody: {
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 10,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 270,
  },
  cardFooter: {
    alignItems: 'center',
    gap: 18,
    paddingTop: 26,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 7,
    borderRadius: 999,
  },
  nextButton: {
    minWidth: 108,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
