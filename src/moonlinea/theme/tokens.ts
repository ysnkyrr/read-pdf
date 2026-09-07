export const moonColors = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F2F5',
  textPrimary: '#111318',
  textSecondary: '#656B76',
  border: '#E2E5EA',
  primary: '#111318',
  primaryText: '#FFFFFF',
  accent: '#2E6BFF',
  success: '#1E7A4A',
  warning: '#9A6500',
  danger: '#B42318',
  overlay: 'rgba(17, 19, 24, 0.48)',
} as const;

export const moonSpacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const moonRadius = {
  small: 10,
  medium: 16,
  large: 24,
  pill: 999,
} as const;

export const moonMotion = {
  pressIn: 90,
  pressOut: 140,
  component: 220,
  page: 300,
  milestone: 520,
} as const;

export const moonShadow = {
  card: {
    shadowColor: '#111318',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
} as const;
