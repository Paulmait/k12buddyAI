import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAPTICS_ENABLED_KEY = 'k12buddy_haptics_enabled';

let hapticsEnabled = true;

// Initialize haptics preference
export async function initHaptics(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(HAPTICS_ENABLED_KEY);
    hapticsEnabled = stored !== 'false';
  } catch (error) {
    console.error('Error loading haptics preference:', error);
  }
}

// Check if haptics are enabled
export function isHapticsEnabled(): boolean {
  return hapticsEnabled;
}

// Toggle haptics
export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  hapticsEnabled = enabled;
  try {
    await AsyncStorage.setItem(HAPTICS_ENABLED_KEY, String(enabled));
  } catch (error) {
    console.error('Error saving haptics preference:', error);
  }
}

// Light impact - for UI selections, toggles
export function lightImpact(): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;

  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    // Silently fail - haptics shouldn't break the app
  }
}

// Medium impact - for button presses, confirmations
export function mediumImpact(): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;

  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (error) {
    // Silently fail
  }
}

// Heavy impact - for important actions, level up, achievements
export function heavyImpact(): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;

  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch (error) {
    // Silently fail
  }
}

// Selection feedback - for picker items, radio buttons
export function selectionFeedback(): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;

  try {
    Haptics.selectionAsync();
  } catch (error) {
    // Silently fail
  }
}

// Success notification - for completed actions, correct answers
export function successNotification(): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;

  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    // Silently fail
  }
}

// Warning notification - for attention needed
export function warningNotification(): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;

  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (error) {
    // Silently fail
  }
}

// Error notification - for incorrect answers, errors
export function errorNotification(): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;

  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (error) {
    // Silently fail
  }
}

// Semantic haptic feedback for app actions
export const AppHaptics = {
  // Base haptics (exposed for custom use)
  lightImpact,
  mediumImpact,
  heavyImpact,
  selectionFeedback,

  // UI interactions
  buttonPress: mediumImpact,
  tabSelect: lightImpact,
  modeSelect: selectionFeedback,
  toggle: lightImpact,

  // Learning actions
  sendMessage: lightImpact,
  correctAnswer: successNotification,
  incorrectAnswer: errorNotification,
  hintReceived: lightImpact,

  // Achievements
  xpEarned: lightImpact,
  badgeEarned: heavyImpact,
  levelUp: heavyImpact,
  streakContinued: mediumImpact,
  challengeComplete: successNotification,

  // Scanning
  scanStart: lightImpact,
  scanSuccess: successNotification,
  scanError: errorNotification,

  // General feedback
  success: successNotification,
  warning: warningNotification,
  error: errorNotification,
};

export default AppHaptics;
