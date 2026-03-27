import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { BrandMark } from '@/components/app/brand-mark';
import { hydrateMobileSessionStore } from '@/lib/auth/mobile-session-store';
import { getOnboardingCompleted } from '@/lib/storage/onboarding';

export default function SplashRoute() {
  const [scale] = useState(() => new Animated.Value(0.94));
  const [opacity] = useState(() => new Animated.Value(0.78));

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.96,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    const timeout = setTimeout(async () => {
      const onboardingCompleted = await getOnboardingCompleted();
      const session = await hydrateMobileSessionStore();
      router.replace(onboardingCompleted ? (session ? '/(tabs)' : '/(auth)/login') : '/onboarding');
    }, 1800);

    return () => {
      clearTimeout(timeout);
      animation.stop();
    };
  }, [opacity, scale]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrap, { opacity, transform: [{ scale }] }]}>
        <BrandMark size={124} backgroundColor="#0f62e6" accentColor="#27d3b1" />
        <Text style={styles.title}>E2C Client</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f62e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 220,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
