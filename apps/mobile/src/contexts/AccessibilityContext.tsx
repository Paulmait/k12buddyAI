import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AccessibilityInfo,
  useWindowDimensions,
  PixelRatio,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESSIBILITY_PREFS_KEY = 'k12buddy_accessibility_prefs';

interface AccessibilityPrefs {
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  screenReaderEnabled: boolean;
}

interface AccessibilityContextType {
  prefs: AccessibilityPrefs;
  fontScale: number;
  scaledFont: (size: number) => number;
  toggleHighContrast: () => void;
  toggleLargeText: () => void;
  toggleReduceMotion: () => void;
  colors: typeof lightColors | typeof highContrastColors;
}

// Light theme colors
const lightColors = {
  primary: '#4F46E5',
  primaryLight: '#EEF2FF',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  error: '#DC2626',
  success: '#10B981',
  warning: '#F59E0B',
};

// High contrast colors for better visibility
const highContrastColors = {
  primary: '#1E3A8A',
  primaryLight: '#DBEAFE',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#000000',
  textSecondary: '#374151',
  border: '#000000',
  error: '#B91C1C',
  success: '#047857',
  warning: '#B45309',
};

const DEFAULT_PREFS: AccessibilityPrefs = {
  highContrast: false,
  largeText: false,
  reduceMotion: false,
  screenReaderEnabled: false,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(DEFAULT_PREFS);
  const { fontScale: systemFontScale } = useWindowDimensions();

  // Calculate effective font scale
  const fontScale = prefs.largeText
    ? Math.max(systemFontScale, 1.3)
    : systemFontScale;

  // Load saved preferences
  useEffect(() => {
    loadPrefs();
    checkSystemAccessibility();
  }, []);

  // Check system accessibility settings
  const checkSystemAccessibility = async () => {
    try {
      const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      const reduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();

      setPrefs(prev => ({
        ...prev,
        screenReaderEnabled,
        reduceMotion: reduceMotionEnabled,
      }));
    } catch (error) {
      console.error('Error checking accessibility settings:', error);
    }
  };

  // Listen for accessibility changes
  useEffect(() => {
    const screenReaderListener = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (enabled) => {
        setPrefs(prev => ({ ...prev, screenReaderEnabled: enabled }));
      }
    );

    const reduceMotionListener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        setPrefs(prev => ({ ...prev, reduceMotion: enabled }));
      }
    );

    return () => {
      screenReaderListener.remove();
      reduceMotionListener.remove();
    };
  }, []);

  const loadPrefs = async () => {
    try {
      const saved = await AsyncStorage.getItem(ACCESSIBILITY_PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPrefs(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Error loading accessibility prefs:', error);
    }
  };

  const savePrefs = async (newPrefs: Partial<AccessibilityPrefs>) => {
    try {
      const updated = { ...prefs, ...newPrefs };
      await AsyncStorage.setItem(ACCESSIBILITY_PREFS_KEY, JSON.stringify(updated));
      setPrefs(updated);
    } catch (error) {
      console.error('Error saving accessibility prefs:', error);
    }
  };

  const toggleHighContrast = useCallback(() => {
    savePrefs({ highContrast: !prefs.highContrast });
  }, [prefs.highContrast]);

  const toggleLargeText = useCallback(() => {
    savePrefs({ largeText: !prefs.largeText });
  }, [prefs.largeText]);

  const toggleReduceMotion = useCallback(() => {
    savePrefs({ reduceMotion: !prefs.reduceMotion });
  }, [prefs.reduceMotion]);

  // Scale font size while respecting min/max bounds
  const scaledFont = useCallback((size: number): number => {
    const scaled = PixelRatio.roundToNearestPixel(size * fontScale);
    // Clamp between reasonable bounds
    return Math.max(12, Math.min(scaled, size * 2));
  }, [fontScale]);

  const colors = prefs.highContrast ? highContrastColors : lightColors;

  const value: AccessibilityContextType = {
    prefs,
    fontScale,
    scaledFont,
    toggleHighContrast,
    toggleLargeText,
    toggleReduceMotion,
    colors,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

// Utility hook for accessible components
export function useAccessibleComponent() {
  const { prefs, scaledFont, colors } = useAccessibility();

  return {
    // Add these props to make components accessible
    getAccessibleProps: (label: string, hint?: string) => ({
      accessible: true,
      accessibilityLabel: label,
      accessibilityHint: hint,
    }),

    // Get accessible text style
    getTextStyle: (baseSize: number) => ({
      fontSize: scaledFont(baseSize),
      color: colors.text,
    }),

    // Get accessible button style
    getButtonStyle: () => ({
      minHeight: 44, // Minimum touch target
      minWidth: 44,
    }),

    // Check if animations should be reduced
    shouldReduceMotion: prefs.reduceMotion,

    // Get colors
    colors,
  };
}

export default AccessibilityContext;
