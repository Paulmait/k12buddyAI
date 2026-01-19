import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useOffline } from '../contexts/OfflineContext';

interface OfflineBannerProps {
  compact?: boolean;
}

export function OfflineBanner({ compact = false }: OfflineBannerProps) {
  const { isOnline, isSyncing, pendingMessageCount, triggerSync } = useOffline();

  // Don't show if online and no pending messages
  if (isOnline && pendingMessageCount === 0 && !isSyncing) {
    return null;
  }

  // Show syncing banner
  if (isSyncing) {
    return (
      <View style={[styles.container, styles.syncingContainer, compact && styles.compact]}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.text}>
          Syncing {pendingMessageCount} message{pendingMessageCount !== 1 ? 's' : ''}...
        </Text>
      </View>
    );
  }

  // Show pending messages banner (online but has queue)
  if (isOnline && pendingMessageCount > 0) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.pendingContainer, compact && styles.compact]}
        onPress={triggerSync}
        activeOpacity={0.8}
      >
        <Text style={styles.pendingIcon}>🔄</Text>
        <Text style={styles.text}>
          {pendingMessageCount} message{pendingMessageCount !== 1 ? 's' : ''} pending
        </Text>
        <Text style={styles.tapText}>Tap to sync</Text>
      </TouchableOpacity>
    );
  }

  // Show offline banner
  if (!isOnline) {
    return (
      <View style={[styles.container, styles.offlineContainer, compact && styles.compact]}>
        <Text style={styles.offlineIcon}>📡</Text>
        <View style={styles.textContainer}>
          <Text style={styles.text}>You're offline</Text>
          {pendingMessageCount > 0 && (
            <Text style={styles.subtext}>
              {pendingMessageCount} message{pendingMessageCount !== 1 ? 's' : ''} will send when connected
            </Text>
          )}
          {pendingMessageCount === 0 && (
            <Text style={styles.subtext}>
              Messages will be saved and sent when you're back online
            </Text>
          )}
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  compact: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  offlineContainer: {
    backgroundColor: '#6B7280',
  },
  syncingContainer: {
    backgroundColor: '#4F46E5',
  },
  pendingContainer: {
    backgroundColor: '#F59E0B',
  },
  offlineIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  pendingIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  subtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  tapText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default OfflineBanner;
