import { StyleSheet, Text, View } from 'react-native';

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
  backgroundColor: _backgroundColor = '#153eaf',
  primaryColor = '#ffffff',
  shadowColor: _shadowColor = '#b9cdfc',
  shadowColorAlt = '#d8e3ff',
  accentColor = '#8aa6ff',
}: BrandMarkProps) {
  const unit = size / 112;
  const wordSize = 42 * unit;
  const wordLineHeight = 46 * unit;
  const dotSize = 11 * unit;

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <View style={styles.wordWrap}>
        <Text
          style={[
            styles.shadowWord,
            {
              color: shadowColorAlt,
              fontSize: wordSize,
              lineHeight: wordLineHeight,
              letterSpacing: -1.4 * unit,
              transform: [{ translateX: -4 * unit }, { translateY: 4 * unit }],
            },
          ]}>
          E2C
        </Text>
        <Text
          style={[
            styles.word,
            {
              color: primaryColor,
              fontSize: wordSize,
              lineHeight: wordLineHeight,
              letterSpacing: -1.4 * unit,
            },
          ]}>
          E2C
        </Text>
      </View>
      <View
        style={[
          styles.energyDot,
          {
            backgroundColor: accentColor,
            width: dotSize,
            height: dotSize,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '6%',
  },
  shadowWord: {
    position: 'absolute',
    fontWeight: '900',
    includeFontPadding: false,
  },
  word: {
    fontWeight: '900',
    includeFontPadding: false,
  },
  energyDot: {
    position: 'absolute',
    opacity: 0.9,
  },
});
