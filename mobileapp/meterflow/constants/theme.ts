import { Platform } from 'react-native';

const primaryLight = '#3158d8';
const primaryDark = '#7f9dff';

export const Colors = {
  light: {
    text: '#15213f',
    background: '#eef2ff',
    surface: '#ffffff',
    surfaceMuted: '#e1e8ff',
    primary: primaryLight,
    tint: primaryLight,
    accent: '#4b6cff',
    accentSoft: '#dbe4ff',
    icon: '#66749b',
    tabIconDefault: '#7a88ad',
    tabIconSelected: primaryLight,
    border: '#d6def6',
    headline: '#0a1230',
    muted: '#5c6b91',
    success: '#3f9b4f',
    danger: '#d94a5f',
  },
  dark: {
    text: '#dfe6ff',
    background: '#07111f',
    surface: '#0d1930',
    surfaceMuted: '#162646',
    primary: primaryDark,
    tint: primaryDark,
    accent: '#8aa6ff',
    accentSoft: '#203359',
    icon: '#9cb0dd',
    tabIconDefault: '#60729c',
    tabIconSelected: primaryDark,
    border: '#243455',
    headline: '#f8fafc',
    muted: '#97a8d2',
    success: '#78d872',
    danger: '#ff7d8e',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
