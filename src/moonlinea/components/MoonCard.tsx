import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { MoonPressable } from './MoonPressable';
import { moonColors, moonRadius, moonShadow, moonSpacing } from '../theme/tokens';

type Props = PropsWithChildren<{
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}>;

export function MoonCard({ children, onPress, style, accessibilityLabel }: Props) {
  const contentStyle = [styles.card, style];

  if (!onPress) {
    return <View style={contentStyle}>{children}</View>;
  }

  return (
    <MoonPressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={contentStyle}
      pressedStyle={styles.pressed}
    >
      {children}
    </MoonPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: moonColors.surface,
    borderRadius: moonRadius.large,
    borderWidth: 1,
    borderColor: moonColors.border,
    padding: moonSpacing[5],
    ...moonShadow.card,
  },
  pressed: {
    shadowOpacity: 0.02,
    elevation: 0,
  },
});
