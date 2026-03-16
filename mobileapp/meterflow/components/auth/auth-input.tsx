import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AuthInputProps = TextInputProps & {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
};

export function AuthInput({ label, icon, hint, style, ...props }: AuthInputProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { width, height } = useWindowDimensions();
  const compact = width < 370 || height < 760;
  const isPasswordField = !!props.secureTextEntry;
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: palette.headline, fontSize: compact ? 13 : 14 }]}>{label}</Text>
      <View
        style={[
          styles.field,
          {
            backgroundColor: palette.surfaceMuted,
            borderColor: palette.border,
            minHeight: compact ? 52 : 56,
            borderRadius: compact ? 16 : 18,
            paddingHorizontal: compact ? 14 : 16,
          },
        ]}>
        <Ionicons name={icon} size={compact ? 17 : 18} color={palette.icon} />
        <TextInput
          placeholderTextColor={palette.muted}
          style={[
            styles.input,
            {
              color: palette.text,
              fontSize: compact ? 14 : 15,
              paddingVertical: compact ? 12 : 14,
            },
            style,
          ]}
          {...props}
          secureTextEntry={isPasswordField ? !passwordVisible : props.secureTextEntry}
        />
        {isPasswordField ? (
          <Pressable onPress={() => setPasswordVisible((value) => !value)} hitSlop={10}>
            <Ionicons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={compact ? 18 : 20}
              color={palette.icon}
            />
          </Pressable>
        ) : null}
      </View>
      {hint ? (
        <Text style={[styles.hint, { color: palette.muted, fontSize: compact ? 11 : 12 }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  field: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
  },
});
