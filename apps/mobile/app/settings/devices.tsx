import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  getUserDevices,
  removeDevice,
  getCurrentDeviceRecordId,
  formatDeviceDisplay,
  DeviceRecord,
} from '../../src/lib/deviceRegistration';

export default function DevicesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  async function loadDevices() {
    try {
      const [deviceList, currentId] = await Promise.all([
        getUserDevices(),
        getCurrentDeviceRecordId(),
      ]);
      setDevices(deviceList);
      setCurrentDeviceId(currentId);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRemoveDevice(device: DeviceRecord) {
    if (device.id === currentDeviceId) {
      Alert.alert(
        'Cannot Remove',
        'You cannot remove the device you are currently using.',
        [{ text: 'OK' }]
      );
      return;
    }

    const displayInfo = formatDeviceDisplay(device);

    Alert.alert(
      'Remove Device',
      `Are you sure you want to remove "${displayInfo.name}"? This device will need to sign in again to access your account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const success = await removeDevice(device.id);
            if (success) {
              setDevices(prev => prev.filter(d => d.id !== device.id));
            } else {
              Alert.alert('Error', 'Failed to remove device');
            }
          },
        },
      ]
    );
  }

  function formatLastSeen(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  function getDeviceIcon(device: DeviceRecord): string {
    const osName = device.os_name?.toLowerCase() || '';
    if (osName.includes('ios')) return '📱';
    if (osName.includes('android')) return '📱';
    if (osName.includes('web')) return '💻';
    if (osName.includes('mac')) return '💻';
    if (osName.includes('win')) return '🖥️';
    return '📱';
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Devices</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadDevices();
          }} />
        }
      >
        {/* Device Count */}
        <View style={styles.countSection}>
          <Text style={styles.countText}>
            {devices.length} device{devices.length !== 1 ? 's' : ''} registered
          </Text>
        </View>

        {/* Devices List */}
        <View style={styles.section}>
          {devices.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📱</Text>
              <Text style={styles.emptyTitle}>No Devices</Text>
              <Text style={styles.emptyText}>
                Devices you sign in with will appear here.
              </Text>
            </View>
          ) : (
            devices.map(device => {
              const isCurrentDevice = device.id === currentDeviceId;
              const displayInfo = formatDeviceDisplay(device);

              return (
                <View
                  key={device.id}
                  style={[
                    styles.deviceItem,
                    isCurrentDevice && styles.deviceItemCurrent,
                  ]}
                >
                  <View style={styles.deviceIcon}>
                    <Text style={styles.deviceIconText}>{getDeviceIcon(device)}</Text>
                  </View>

                  <View style={styles.deviceInfo}>
                    <View style={styles.deviceNameRow}>
                      <Text style={styles.deviceName}>{displayInfo.name}</Text>
                      {isCurrentDevice && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>This Device</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.deviceDetails}>{displayInfo.details}</Text>
                    <Text style={styles.deviceLastSeen}>
                      Last active: {formatLastSeen(device.last_seen_at)}
                    </Text>
                    {device.approximate_location?.city && (
                      <Text style={styles.deviceLocation}>
                        📍 {device.approximate_location.city}
                        {device.approximate_location.region && `, ${device.approximate_location.region}`}
                      </Text>
                    )}
                  </View>

                  {!isCurrentDevice && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveDevice(device)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Text style={styles.securityNoteIcon}>🔒</Text>
          <Text style={styles.securityNoteText}>
            If you don't recognize a device, remove it and change your password immediately.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  backButtonIcon: {
    fontSize: 24,
    color: '#4F46E5',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  countSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  countText: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#fff',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  deviceItemCurrent: {
    backgroundColor: '#F0FDF4',
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceIconText: {
    fontSize: 24,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 8,
  },
  currentBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  deviceDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  deviceLastSeen: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  deviceLocation: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  removeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  securityNoteIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  securityNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 32,
  },
});
