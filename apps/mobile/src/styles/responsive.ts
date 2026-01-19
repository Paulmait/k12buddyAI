/**
 * Responsive Styles
 * Shared responsive StyleSheet patterns and utilities
 */

import { StyleSheet, ViewStyle, TextStyle, ImageStyle, Dimensions } from 'react-native';
import { getResponsiveValue, BREAKPOINTS, ResponsiveValues } from '../hooks/useResponsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Color palette (consistent with existing codebase)
export const COLORS = {
  primary: '#4F46E5',
  primaryLight: '#C7D2FE',
  primaryBackground: '#EEF2FF',
  secondary: '#6B7280',
  text: '#1F2937',
  textLight: '#374151',
  textMuted: '#6B7280',
  background: '#FFFFFF',
  backgroundLight: '#F9FAFB',
  backgroundAlt: '#F3F4F6',
  border: '#E5E7EB',
  success: '#10B981',
  warning: '#FCD34D',
  danger: '#DC2626',
  white: '#FFFFFF',
} as const;

// Spacing scale
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// Typography scale
export const TYPOGRAPHY = {
  h1: { fontSize: 28, fontWeight: 'bold' as const, lineHeight: 36 },
  h2: { fontSize: 24, fontWeight: 'bold' as const, lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  h4: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: 'normal' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: 'normal' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: 'normal' as const, lineHeight: 16 },
  button: { fontSize: 16, fontWeight: '600' as const },
} as const;

// Border radius scale
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// Shadow presets
export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

// Type for style objects
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Create responsive styles based on device type
 */
export function createResponsiveStyles<
  Phone extends NamedStyles<Phone>,
  Tablet extends NamedStyles<Tablet>,
  LargeTablet extends NamedStyles<LargeTablet>
>(
  phoneStyles: Phone,
  tabletStyles?: Partial<Tablet>,
  largeTabletStyles?: Partial<LargeTablet>
): Phone {
  const { width } = Dimensions.get('window');

  if (width > BREAKPOINTS.TABLET_MAX && largeTabletStyles) {
    return StyleSheet.create({
      ...phoneStyles,
      ...tabletStyles,
      ...largeTabletStyles,
    }) as Phone;
  }

  if (width > BREAKPOINTS.PHONE_MAX && tabletStyles) {
    return StyleSheet.create({
      ...phoneStyles,
      ...tabletStyles,
    }) as Phone;
  }

  return StyleSheet.create(phoneStyles) as Phone;
}

/**
 * Common responsive layouts
 */
export const layouts = {
  // Centered container with max width
  centeredContainer: (maxWidth?: number): ViewStyle => ({
    flex: 1,
    width: '100%',
    maxWidth: maxWidth ?? getResponsiveValue({
      phone: SCREEN_WIDTH,
      tablet: 700,
      largeTablet: 900,
    }),
    alignSelf: 'center',
  }),

  // Row with responsive gap
  row: (gap?: number): ViewStyle => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap ?? getResponsiveValue({
      phone: 8,
      tablet: 12,
      largeTablet: 16,
    }),
  }),

  // Grid container
  grid: (columns?: number): ViewStyle => {
    const cols = columns ?? getResponsiveValue({
      phone: 1,
      tablet: 2,
      largeTablet: 3,
    });
    return {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: getResponsiveValue({
        phone: 12,
        tablet: 16,
        largeTablet: 20,
      }),
    };
  },

  // Screen container with padding
  screen: (): ViewStyle => ({
    flex: 1,
    backgroundColor: COLORS.background,
    padding: getResponsiveValue({
      phone: 16,
      tablet: 24,
      largeTablet: 32,
    }),
  }),
};

/**
 * Common card styles
 */
export const cardStyles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    ...SHADOWS.md,
  },
  outlined: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  selected: {
    backgroundColor: COLORS.primaryBackground,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
});

/**
 * Common button styles
 */
export const buttonStyles = StyleSheet.create({
  primary: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  danger: {
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  textSecondary: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
});

/**
 * Common input styles
 */
export const inputStyles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.backgroundAlt,
    borderRadius: RADIUS.md,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  focused: {
    backgroundColor: COLORS.backgroundAlt,
    borderRadius: RADIUS.md,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  error: {
    backgroundColor: COLORS.backgroundAlt,
    borderRadius: RADIUS.md,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 2,
    borderColor: COLORS.danger,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 8,
  },
});

/**
 * Common list item styles
 */
export const listStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  itemSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  itemArrow: {
    fontSize: 18,
    color: COLORS.textMuted,
  },
});

/**
 * Common modal styles
 */
export const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 24,
    width: getResponsiveValue({
      phone: SCREEN_WIDTH - 32,
      tablet: Math.min(SCREEN_WIDTH * 0.7, 500),
      largeTablet: Math.min(SCREEN_WIDTH * 0.5, 600),
    }),
    maxHeight: '80%',
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
});

/**
 * Get responsive grid item width
 */
export function getGridItemWidth(
  columns: number,
  gap = 12,
  containerPadding = 24
): number {
  const { width } = Dimensions.get('window');
  const availableWidth = width - (containerPadding * 2);
  const totalGapWidth = gap * (columns - 1);
  return (availableWidth - totalGapWidth) / columns;
}

/**
 * Get responsive columns count
 */
export function getColumns(
  phone = 1,
  tablet = 2,
  largeTablet = 3
): number {
  return getResponsiveValue({
    phone,
    tablet,
    largeTablet,
  });
}

export default {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  layouts,
  cardStyles,
  buttonStyles,
  inputStyles,
  listStyles,
  modalStyles,
  createResponsiveStyles,
  getGridItemWidth,
  getColumns,
};
