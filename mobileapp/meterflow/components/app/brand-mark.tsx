import { StyleSheet, View } from 'react-native';

type BrandMarkProps = {
  size?: number;
  backgroundColor?: string;
  primaryColor?: string;
  shadowColor?: string;
  shadowColorAlt?: string;
  accentColor?: string;
};

export function BrandMark({
  size = 112,
  backgroundColor = '#153eaf',
  primaryColor = '#ffffff',
  shadowColor = '#b9cdfc',
  shadowColorAlt = '#d8e3ff',
  accentColor = '#8aa6ff',
}: BrandMarkProps) {
  const unit = size / 112;

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <View
        style={[
          styles.shadowStem,
          {
            backgroundColor: shadowColor,
            width: 20 * unit,
            height: 58 * unit,
            left: 24 * unit,
            top: 26 * unit,
            borderRadius: 8 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.shadowArmTop,
          {
            backgroundColor: shadowColorAlt,
            width: 26 * unit,
            height: 18 * unit,
            left: 42 * unit,
            top: 26 * unit,
            borderRadius: 7 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.shadowArmMid,
          {
            backgroundColor: shadowColor,
            width: 22 * unit,
            height: 18 * unit,
            left: 42 * unit,
            top: 46 * unit,
            borderRadius: 7 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.primaryStem,
          {
            backgroundColor: primaryColor,
            width: 20 * unit,
            height: 60 * unit,
            left: 42 * unit,
            top: 26 * unit,
            borderRadius: 8 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.primaryArmTop,
          {
            backgroundColor: primaryColor,
            width: 28 * unit,
            height: 18 * unit,
            left: 54 * unit,
            top: 26 * unit,
            borderRadius: 7 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.primaryArmMid,
          {
            backgroundColor: primaryColor,
            width: 24 * unit,
            height: 18 * unit,
            left: 54 * unit,
            top: 46 * unit,
            borderRadius: 7 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.cutCorner,
          {
            backgroundColor,
            width: 24 * unit,
            height: 24 * unit,
            left: 62 * unit,
            top: 62 * unit,
            borderBottomLeftRadius: 16 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.energyDot,
          {
            backgroundColor: accentColor,
            width: 10 * unit,
            height: 10 * unit,
            right: 18 * unit,
            top: 18 * unit,
            borderRadius: 999,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
  },
  shadowStem: {
    position: 'absolute',
    transform: [{ translateX: -12 }, { translateY: 2 }],
    opacity: 0.95,
  },
  shadowArmTop: {
    position: 'absolute',
    transform: [{ translateX: -10 }, { translateY: 2 }],
    opacity: 0.95,
  },
  shadowArmMid: {
    position: 'absolute',
    transform: [{ translateX: -10 }, { translateY: 2 }],
    opacity: 0.95,
  },
  primaryStem: {
    position: 'absolute',
  },
  primaryArmTop: {
    position: 'absolute',
  },
  primaryArmMid: {
    position: 'absolute',
  },
  cutCorner: {
    position: 'absolute',
  },
  energyDot: {
    position: 'absolute',
    opacity: 0.9,
  },
});
