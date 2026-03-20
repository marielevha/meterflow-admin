import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { BrandMark } from '@/components/app/brand-mark';
import { hydrateAgentSessionStore } from '@/lib/auth/agent-session-store';
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
      const session = await hydrateAgentSessionStore();
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
        <BrandMark size={124} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#153eaf',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 124,
    height: 124,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
