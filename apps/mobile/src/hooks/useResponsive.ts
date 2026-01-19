/**
 * useResponsive Hook
 * Provides responsive design utilities for phone, tablet, and large tablet layouts
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dimensions, ScaledSize, Platform, PixelRatio } from 'react-native';

// Breakpoints
const PHONE_MAX = 600;
const TABLET_MAX = 900;

// Device types
export type DeviceType = 'phone' | 'tablet' | 'largeTablet';

// Responsive values type
export interface ResponsiveValues<T> {
  phone: T;
  tablet: T;
  largeTablet?: T;
}

export interface ResponsiveConfig {
  width: number;
  height: number;
  deviceType: DeviceType;
  isPhone: boolean;
  isTablet: boolean;
  isLargeTablet: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  scale: number;
  fontScale: number;
}

export interface UseResponsiveReturn extends ResponsiveConfig {
  // Value helpers
  responsiveValue: <T>(values: ResponsiveValues<T>) => T;

  // Grid helpers
  getColumns: (phoneColumns?: number, tabletColumns?: number, largeTabletColumns?: number) => number;
  getGridItemWidth: (columns: number, gap?: number, containerPadding?: number) => number;

  // Spacing helpers
  getSpacing: (values: ResponsiveValues<number>) => number;
  getPadding: () => number;
  getMargin: () => number;

  // Font helpers
  getScaledFontSize: (baseFontSize: number) => number;
  getFontSize: (values: ResponsiveValues<number>) => number;

  // Layout helpers
  getMaxWidth: () => number;
  getCardWidth: () => number;
  getModalWidth: () => number;
}

function getDeviceType(width: number): DeviceType {
  if (width <= PHONE_MAX) return 'phone';
  if (width <= TABLET_MAX) return 'tablet';
  return 'largeTablet';
}

export function useResponsive(): UseResponsiveReturn {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;
  const deviceType = getDeviceType(width);
  const scale = PixelRatio.get();
  const fontScale = PixelRatio.getFontScale();

  const config: ResponsiveConfig = useMemo(() => ({
    width,
    height,
    deviceType,
    isPhone: deviceType === 'phone',
    isTablet: deviceType === 'tablet',
    isLargeTablet: deviceType === 'largeTablet',
    isLandscape: width > height,
    isPortrait: height >= width,
    scale,
    fontScale,
  }), [width, height, deviceType, scale, fontScale]);

  // Get value based on device type
  const responsiveValue = useCallback(<T>(values: ResponsiveValues<T>): T => {
    switch (deviceType) {
      case 'phone':
        return values.phone;
      case 'tablet':
        return values.tablet;
      case 'largeTablet':
        return values.largeTablet ?? values.tablet;
      default:
        return values.phone;
    }
  }, [deviceType]);

  // Get number of columns for grid layouts
  const getColumns = useCallback((
    phoneColumns = 1,
    tabletColumns = 2,
    largeTabletColumns = 3
  ): number => {
    return responsiveValue({
      phone: phoneColumns,
      tablet: tabletColumns,
      largeTablet: largeTabletColumns,
    });
  }, [responsiveValue]);

  // Calculate grid item width
  const getGridItemWidth = useCallback((
    columns: number,
    gap = 12,
    containerPadding = 24
  ): number => {
    const availableWidth = width - (containerPadding * 2);
    const totalGapWidth = gap * (columns - 1);
    return (availableWidth - totalGapWidth) / columns;
  }, [width]);

  // Get responsive spacing
  const getSpacing = useCallback((values: ResponsiveValues<number>): number => {
    return responsiveValue(values);
  }, [responsiveValue]);

  // Get default padding based on device
  const getPadding = useCallback((): number => {
    return responsiveValue({
      phone: 16,
      tablet: 24,
      largeTablet: 32,
    });
  }, [responsiveValue]);

  // Get default margin based on device
  const getMargin = useCallback((): number => {
    return responsiveValue({
      phone: 12,
      tablet: 16,
      largeTablet: 20,
    });
  }, [responsiveValue]);

  // Scale font size based on screen width
  const getScaledFontSize = useCallback((baseFontSize: number): number => {
    // Base width for scaling (iPhone 8 width)
    const baseWidth = 375;
    const scaleFactor = width / baseWidth;

    // Limit scaling to prevent extremely large/small fonts
    const clampedScale = Math.max(0.85, Math.min(scaleFactor, 1.3));

    // Apply font scale from device settings
    const scaled = baseFontSize * clampedScale;

    // Round to avoid sub-pixel rendering issues
    return Math.round(scaled);
  }, [width]);

  // Get responsive font size
  const getFontSize = useCallback((values: ResponsiveValues<number>): number => {
    return responsiveValue(values);
  }, [responsiveValue]);

  // Get maximum content width (for centering on large screens)
  const getMaxWidth = useCallback((): number => {
    return responsiveValue({
      phone: width,
      tablet: Math.min(width, 700),
      largeTablet: Math.min(width, 900),
    });
  }, [responsiveValue, width]);

  // Get card width
  const getCardWidth = useCallback((): number => {
    return responsiveValue({
      phone: width - 32,
      tablet: Math.min(width - 48, 400),
      largeTablet: Math.min(width - 64, 450),
    });
  }, [responsiveValue, width]);

  // Get modal width
  const getModalWidth = useCallback((): number => {
    return responsiveValue({
      phone: width - 32,
      tablet: Math.min(width * 0.7, 500),
      largeTablet: Math.min(width * 0.5, 600),
    });
  }, [responsiveValue, width]);

  return {
    ...config,
    responsiveValue,
    getColumns,
    getGridItemWidth,
    getSpacing,
    getPadding,
    getMargin,
    getScaledFontSize,
    getFontSize,
    getMaxWidth,
    getCardWidth,
    getModalWidth,
  };
}

// Static helper for use outside of components
export function getResponsiveValue<T>(values: ResponsiveValues<T>): T {
  const { width } = Dimensions.get('window');
  const deviceType = getDeviceType(width);

  switch (deviceType) {
    case 'phone':
      return values.phone;
    case 'tablet':
      return values.tablet;
    case 'largeTablet':
      return values.largeTablet ?? values.tablet;
    default:
      return values.phone;
  }
}

// Breakpoint constants export
export const BREAKPOINTS = {
  PHONE_MAX,
  TABLET_MAX,
} as const;

export default useResponsive;
