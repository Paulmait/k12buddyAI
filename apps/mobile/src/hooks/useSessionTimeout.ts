import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import { AuditLog } from '../lib/auditLog';

interface SessionTimeoutConfig {
  // Time before warning (in milliseconds)
  warningTimeout?: number;
  // Time before logout (in milliseconds)
  logoutTimeout?: number;
  // Callback when warning should show
  onWarning?: (remainingTime: number) => void;
  // Callback when session expires
  onTimeout?: () => void;
  // Whether to reset timer on activity
  resetOnActivity?: boolean;
}

const DEFAULT_WARNING_TIMEOUT = 25 * 60 * 1000; // 25 minutes
const DEFAULT_LOGOUT_TIMEOUT = 30 * 60 * 1000; // 30 minutes

/**
 * Hook to manage session timeout for security
 */
export function useSessionTimeout(config: SessionTimeoutConfig = {}) {
  const {
    warningTimeout = DEFAULT_WARNING_TIMEOUT,
    logoutTimeout = DEFAULT_LOGOUT_TIMEOUT,
    onWarning,
    onTimeout,
    resetOnActivity = true,
  } = config;

  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [remainingTime, setRemainingTime] = useState(logoutTimeout);

  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityTime = useRef<number>(Date.now());
  const appState = useRef(AppState.currentState);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (warningTimer.current) {
      clearTimeout(warningTimer.current);
      warningTimer.current = null;
    }
    if (logoutTimer.current) {
      clearTimeout(logoutTimer.current);
      logoutTimer.current = null;
    }
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
  }, []);

  // Handle session timeout
  const handleTimeout = useCallback(async () => {
    clearTimers();
    setIsWarningVisible(false);

    try {
      // Get current user for audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await AuditLog.logout(user.id);
      }

      // Sign out
      await supabase.auth.signOut();

      // Call custom timeout handler
      onTimeout?.();
    } catch (error) {
      console.error('Error during session timeout:', error);
    }
  }, [clearTimers, onTimeout]);

  // Start countdown to logout
  const startCountdown = useCallback(() => {
    const timeUntilLogout = logoutTimeout - warningTimeout;
    setRemainingTime(timeUntilLogout);
    setIsWarningVisible(true);
    onWarning?.(timeUntilLogout);

    // Update remaining time every second
    countdownInterval.current = setInterval(() => {
      setRemainingTime(prev => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          handleTimeout();
          return 0;
        }
        return newTime;
      });
    }, 1000);

    // Set final logout timer
    logoutTimer.current = setTimeout(handleTimeout, timeUntilLogout);
  }, [logoutTimeout, warningTimeout, onWarning, handleTimeout]);

  // Reset the session timer
  const resetTimer = useCallback(() => {
    clearTimers();
    setIsWarningVisible(false);
    setRemainingTime(logoutTimeout);
    lastActivityTime.current = Date.now();

    // Set warning timer
    warningTimer.current = setTimeout(startCountdown, warningTimeout);
  }, [clearTimers, logoutTimeout, warningTimeout, startCountdown]);

  // Record user activity
  const recordActivity = useCallback(() => {
    if (resetOnActivity && !isWarningVisible) {
      lastActivityTime.current = Date.now();
      resetTimer();
    }
  }, [resetOnActivity, isWarningVisible, resetTimer]);

  // Extend session (user clicked "Stay logged in")
  const extendSession = useCallback(() => {
    setIsWarningVisible(false);
    resetTimer();
  }, [resetTimer]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - check if session should have expired
        const timeSinceActivity = Date.now() - lastActivityTime.current;

        if (timeSinceActivity >= logoutTimeout) {
          // Session expired while in background
          handleTimeout();
        } else if (timeSinceActivity >= warningTimeout) {
          // Should show warning
          startCountdown();
        } else {
          // Resume normal timer
          resetTimer();
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [logoutTimeout, warningTimeout, handleTimeout, startCountdown, resetTimer]);

  // Initialize timer on mount
  useEffect(() => {
    resetTimer();

    return () => {
      clearTimers();
    };
  }, [resetTimer, clearTimers]);

  return {
    isWarningVisible,
    remainingTime,
    remainingMinutes: Math.ceil(remainingTime / 60000),
    remainingSeconds: Math.ceil((remainingTime % 60000) / 1000),
    recordActivity,
    extendSession,
    resetTimer,
  };
}

/**
 * Format remaining time for display
 */
export function formatRemainingTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.ceil((ms % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}s`;
}

export default useSessionTimeout;
