/**
 * Unit tests for useNetworkStatus hook
 */

import { renderHook, act } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStatus } from '../useNetworkStatus';

// Mock NetInfo
jest.mock('@react-native-community/netinfo');

const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

describe('useNetworkStatus', () => {
  let mockCallback: ((state: unknown) => void) | null = null;

  beforeEach(() => {
    mockCallback = null;
    mockNetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      details: null,
    } as never);

    mockNetInfo.addEventListener.mockImplementation((callback) => {
      mockCallback = callback;
      return () => {
        mockCallback = null;
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with connected state', async () => {
    const { result } = renderHook(() => useNetworkStatus());

    // Initial state should assume connected
    expect(result.current.isConnected).toBe(true);
  });

  it('should fetch initial network state', async () => {
    renderHook(() => useNetworkStatus());

    expect(mockNetInfo.fetch).toHaveBeenCalled();
  });

  it('should subscribe to network changes', () => {
    renderHook(() => useNetworkStatus());

    expect(mockNetInfo.addEventListener).toHaveBeenCalled();
  });

  it('should update when network changes to offline', async () => {
    const { result } = renderHook(() => useNetworkStatus());

    // Simulate going offline
    act(() => {
      if (mockCallback) {
        mockCallback({
          isConnected: false,
          isInternetReachable: false,
          type: 'none',
        });
      }
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it('should update when network changes to online', async () => {
    mockNetInfo.fetch.mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
      details: null,
    } as never);

    const { result } = renderHook(() => useNetworkStatus());

    // Simulate coming back online
    act(() => {
      if (mockCallback) {
        mockCallback({
          isConnected: true,
          isInternetReachable: true,
          type: 'wifi',
        });
      }
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });

  it('should detect connection type', async () => {
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      if (mockCallback) {
        mockCallback({
          isConnected: true,
          isInternetReachable: true,
          type: 'cellular',
        });
      }
    });

    expect(result.current.connectionType).toBe('cellular');
  });

  it('should handle wifi connection', async () => {
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      if (mockCallback) {
        mockCallback({
          isConnected: true,
          isInternetReachable: true,
          type: 'wifi',
        });
      }
    });

    expect(result.current.isWifi).toBe(true);
    expect(result.current.isCellular).toBe(false);
  });

  it('should handle cellular connection', async () => {
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      if (mockCallback) {
        mockCallback({
          isConnected: true,
          isInternetReachable: true,
          type: 'cellular',
        });
      }
    });

    expect(result.current.isWifi).toBe(false);
    expect(result.current.isCellular).toBe(true);
  });

  it('should unsubscribe on unmount', () => {
    const unsubscribe = jest.fn();
    mockNetInfo.addEventListener.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useNetworkStatus());

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should handle internet not reachable', async () => {
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      if (mockCallback) {
        mockCallback({
          isConnected: true,
          isInternetReachable: false,
          type: 'wifi',
        });
      }
    });

    expect(result.current.isInternetReachable).toBe(false);
  });
});
