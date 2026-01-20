import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { syncQueuedMessages, hasPendingMessages, getPendingMessageCount } from '../lib/syncService';
// Imports for future gamification caching
// import { getCachedGamificationStats, cacheGamificationStats } from '../lib/offlineStorage';

interface OfflineContextType {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  isSyncing: boolean;
  pendingMessageCount: number;
  lastSyncError: string | null;
  triggerSync: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const network = useNetworkStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingMessageCount, setPendingMessageCount] = useState(0);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const wasOffline = useRef(false);

  // Check pending messages on mount and when network changes
  useEffect(() => {
    checkPendingMessages();
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (!network.isConnected) {
      wasOffline.current = true;
      return;
    }

    // Just came back online
    if (wasOffline.current && network.isConnected && network.isInternetReachable) {
      console.log('Network restored, triggering sync...');
      wasOffline.current = false;
      triggerSync();
    }
  }, [network.isConnected, network.isInternetReachable]);

  // Sync when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [network.isConnected]);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active' && network.isConnected) {
      await checkPendingMessages();
      if (await hasPendingMessages()) {
        triggerSync();
      }
    }
  };

  const checkPendingMessages = async () => {
    const count = await getPendingMessageCount();
    setPendingMessageCount(count);
  };

  const triggerSync = useCallback(async () => {
    if (isSyncing || !network.isConnected) return;

    setIsSyncing(true);
    setLastSyncError(null);

    try {
      const result = await syncQueuedMessages();

      if (!result.success && result.errors.length > 0) {
        setLastSyncError(result.errors[0]);
      }

      await checkPendingMessages();
    } catch (error) {
      console.error('Sync error:', error);
      setLastSyncError('Failed to sync messages');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, network.isConnected]);

  const value: OfflineContextType = {
    isOnline: network.isConnected,
    isInternetReachable: network.isInternetReachable,
    isSyncing,
    pendingMessageCount,
    lastSyncError,
    triggerSync,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}

export default OfflineContext;
