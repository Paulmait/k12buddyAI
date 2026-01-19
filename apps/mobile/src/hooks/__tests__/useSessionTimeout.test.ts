/**
 * Unit tests for useSessionTimeout hook
 */

import { renderHook, act } from '@testing-library/react-native';
import { useSessionTimeout } from '../useSessionTimeout';

// Mock the supabase auth
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(() => Promise.resolve({ error: null })),
    },
  },
}));

describe('useSessionTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useSessionTimeout());

    expect(result.current.isWarningVisible).toBe(false);
    expect(result.current.timeRemaining).toBeGreaterThan(0);
  });

  it('should show warning before session expires', () => {
    const { result } = renderHook(() =>
      useSessionTimeout({
        timeoutMinutes: 1,
        warningMinutes: 0.5,
      })
    );

    // Fast forward to just past the warning threshold
    act(() => {
      jest.advanceTimersByTime(31 * 1000); // 31 seconds
    });

    // Warning should be visible
    expect(result.current.isWarningVisible).toBe(true);
  });

  it('should reset timer on activity', () => {
    const { result } = renderHook(() =>
      useSessionTimeout({
        timeoutMinutes: 1,
        warningMinutes: 0.5,
      })
    );

    // Advance time partially
    act(() => {
      jest.advanceTimersByTime(20 * 1000);
    });

    // Reset activity
    act(() => {
      result.current.resetTimeout();
    });

    // Time remaining should be reset to full timeout
    expect(result.current.timeRemaining).toBeGreaterThanOrEqual(55);
  });

  it('should call onTimeout when session expires', () => {
    const onTimeout = jest.fn();
    renderHook(() =>
      useSessionTimeout({
        timeoutMinutes: 1,
        warningMinutes: 0.5,
        onTimeout,
      })
    );

    // Fast forward past the timeout
    act(() => {
      jest.advanceTimersByTime(61 * 1000);
    });

    expect(onTimeout).toHaveBeenCalled();
  });

  it('should extend session when extendSession is called', () => {
    const { result } = renderHook(() =>
      useSessionTimeout({
        timeoutMinutes: 1,
        warningMinutes: 0.5,
      })
    );

    // Get warning to show
    act(() => {
      jest.advanceTimersByTime(31 * 1000);
    });

    expect(result.current.isWarningVisible).toBe(true);

    // Extend session
    act(() => {
      result.current.extendSession();
    });

    // Warning should be hidden
    expect(result.current.isWarningVisible).toBe(false);
  });

  it('should calculate time remaining correctly', () => {
    const { result } = renderHook(() =>
      useSessionTimeout({
        timeoutMinutes: 2,
      })
    );

    act(() => {
      jest.advanceTimersByTime(30 * 1000); // 30 seconds
    });

    // Should have about 90 seconds remaining (120 - 30)
    expect(result.current.timeRemaining).toBeLessThanOrEqual(90);
    expect(result.current.timeRemaining).toBeGreaterThanOrEqual(85);
  });

  it('should not show warning if disabled', () => {
    const { result } = renderHook(() =>
      useSessionTimeout({
        timeoutMinutes: 1,
        warningMinutes: 0.5,
        enabled: false,
      })
    );

    act(() => {
      jest.advanceTimersByTime(61 * 1000);
    });

    expect(result.current.isWarningVisible).toBe(false);
  });
});
