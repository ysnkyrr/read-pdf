import { StyleSheet, ViewStyle } from 'react-native';
import { MoonPressable } from './MoonPressable';
import { MoonText } from './MoonText';
import { moonColors, moonRadius, moonSpacing } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function MoonButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
  style,
  accessibilityLabel,
}: Props) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  return (
    <MoonPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.base,
        isPrimary && styles.primary,
        !isPrimary && styles.secondary,
        isDanger && styles.danger,
        style,
      ]}
    >
      <MoonText style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}>
        {label}
      </MoonText>
    </MoonPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: moonRadius.medium,
    paddingHorizontal: moonSpacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primary: {
    backgroundColor: moonColors.primary,
    borderColor: moonColors.primary,
  },
  secondary: {
    backgroundColor: moonColors.surface,
    borderColor: moonColors.border,
  },
  danger: {
    backgroundColor: moonColors.danger,
    borderColor: moonColors.danger,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryLabel: {
    color: moonColors.primaryText,
  },
  secondaryLabel: {
    color: moonColors.textPrimary,
  },
});
