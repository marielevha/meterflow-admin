import type { PropsWithChildren } from 'react';
import { Redirect } from 'expo-router';

import { useAgentSession } from '@/providers/agent-session-provider';

export function RequireAgentAuth({ children }: PropsWithChildren) {
  const { isAuthenticated, isReady } = useAgentSession();

  if (!isReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <>{children}</>;
}
