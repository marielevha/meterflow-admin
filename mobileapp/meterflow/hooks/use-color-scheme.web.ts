import { useAppTheme } from '@/providers/app-theme-provider';

export function useColorScheme() {
  return useAppTheme().resolvedTheme;
}
