import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

export function CircularLoading({
  palette,
  size = 56,
}: {
  palette: (typeof Colors)['light'];
  size?: number;
}) {
  return (
    <View
      style={[
        styles.loader,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.surfaceMuted,
          borderColor: palette.border,
        },
      ]}>
      <ActivityIndicator size="small" color={palette.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
