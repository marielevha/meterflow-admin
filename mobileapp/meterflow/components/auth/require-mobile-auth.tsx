import type { PropsWithChildren } from 'react';
import { Redirect } from 'expo-router';

import { useMobileSession } from '@/providers/mobile-session-provider';

export function RequireMobileAuth({ children }: PropsWithChildren) {
  const { isAuthenticated } = useMobileSession();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <>{children}</>;
}
