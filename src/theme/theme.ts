/**
 * App Theme
 * Central design system: colors, typography, spacing, shadows, border radii.
 */

export const Colors = {
  // Primary palette
  primary: '#6C63FF',
  primaryDark: '#4B44CC',
  primaryLight: '#A89CFF',

  // Accent
  accent: '#43C6AC',
  accentDark: '#2E9E8A',

  // Semantic
  success: '#4CAF50',
  warning: '#F7971E',
  error: '#FF6584',
  info: '#56CCF2',

  // Neutrals
  background: '#0F0E1A',
  surface: '#1C1A2E',
  surfaceElevated: '#252340',
  card: '#1E1C30',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#B0AECF',
  textMuted: '#6B6987',
  textOnPrimary: '#FFFFFF',

  // Borders
  border: '#2E2C45',
  borderLight: '#3D3B58',

  // Calendar event colors
  event1: '#6C63FF',
  event2: '#FF6584',
  event3: '#43C6AC',
  event4: '#F7971E',
  event5: '#56CCF2',
} as const;

export const Typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    xxxl: 34,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
} as const;

export const Theme = {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
};

export default Theme;
