import { useCallback } from 'react';
import { AppHaptics } from '../lib/haptics';
import { AppSounds } from '../lib/sounds';

/**
 * Combined feedback hook for haptics and sounds
 * Provides semantic feedback methods for app interactions
 */
export function useFeedback() {
  // UI interactions
  const onButtonPress = useCallback(() => {
    AppHaptics.buttonPress();
    AppSounds.tap();
  }, []);

  const onTabSelect = useCallback(() => {
    AppHaptics.tabSelect();
  }, []);

  const onModeSelect = useCallback(() => {
    AppHaptics.modeSelect();
  }, []);

  const onToggle = useCallback(() => {
    AppHaptics.toggle();
  }, []);

  // Learning actions
  const onMessageSend = useCallback(() => {
    AppHaptics.sendMessage();
    AppSounds.messageSent();
  }, []);

  const onMessageReceive = useCallback(() => {
    AppSounds.messageReceived();
  }, []);

  const onCorrectAnswer = useCallback(() => {
    AppHaptics.correctAnswer();
    AppSounds.correctAnswer();
  }, []);

  const onIncorrectAnswer = useCallback(() => {
    AppHaptics.incorrectAnswer();
    AppSounds.incorrectAnswer();
  }, []);

  // Achievements
  const onXpEarned = useCallback(() => {
    AppHaptics.xpEarned();
    AppSounds.xpEarned();
  }, []);

  const onBadgeEarned = useCallback(() => {
    AppHaptics.badgeEarned();
    AppSounds.badgeEarned();
  }, []);

  const onLevelUp = useCallback(() => {
    AppHaptics.levelUp();
    AppSounds.levelUp();
  }, []);

  const onStreakContinued = useCallback(() => {
    AppHaptics.streakContinued();
    AppSounds.streakContinued();
  }, []);

  const onChallengeComplete = useCallback(() => {
    AppHaptics.challengeComplete();
    AppSounds.success();
  }, []);

  // Scanning
  const onScanStart = useCallback(() => {
    AppHaptics.scanStart();
  }, []);

  const onScanSuccess = useCallback(() => {
    AppHaptics.scanSuccess();
    AppSounds.success();
  }, []);

  const onScanError = useCallback(() => {
    AppHaptics.scanError();
    AppSounds.error();
  }, []);

  // General feedback
  const onSuccess = useCallback(() => {
    AppHaptics.success();
    AppSounds.success();
  }, []);

  const onWarning = useCallback(() => {
    AppHaptics.warning();
  }, []);

  const onError = useCallback(() => {
    AppHaptics.error();
    AppSounds.error();
  }, []);

  const onNotification = useCallback(() => {
    AppHaptics.lightImpact();
    AppSounds.notification();
  }, []);

  return {
    // UI
    onButtonPress,
    onTabSelect,
    onModeSelect,
    onToggle,

    // Learning
    onMessageSend,
    onMessageReceive,
    onCorrectAnswer,
    onIncorrectAnswer,

    // Achievements
    onXpEarned,
    onBadgeEarned,
    onLevelUp,
    onStreakContinued,
    onChallengeComplete,

    // Scanning
    onScanStart,
    onScanSuccess,
    onScanError,

    // General
    onSuccess,
    onWarning,
    onError,
    onNotification,
  };
}

export default useFeedback;
