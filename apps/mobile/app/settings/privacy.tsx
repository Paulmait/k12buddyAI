import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  getUserProfile,
  updateUserProfile,
  updateAnalyticsOptOut,
  downloadMyData,
} from '../../src/lib/accountService';
import {
  getStoredLocationConsent,
  revokeLocationConsent,
  updateUserLocation,
} from '../../src/lib/locationService';

interface PrivacySettings {
  locationConsent: boolean;
  analyticsOptOut: boolean;
}

export default function PrivacySettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PrivacySettings>({
    locationConsent: false,
    analyticsOptOut: false,
  });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const [profile, locationConsent] = await Promise.all([
        getUserProfile(),
        getStoredLocationConsent(),
      ]);

      setSettings({
        locationConsent,
        analyticsOptOut: profile?.analytics_opt_out ?? false,
      });
    } catch (error) {
      console.error('Error loading privacy settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLocationToggle(value: boolean) {
    setSettings(prev => ({ ...prev, locationConsent: value }));

    if (value) {
      const success = await updateUserLocation();
      if (!success) {
        setSettings(prev => ({ ...prev, locationConsent: false }));
        Alert.alert(
          'Location Permission Required',
          'Please enable location permission in your device settings.',
          [{ text: 'OK' }]
        );
      }
    } else {
      await revokeLocationConsent();
    }
  }

  async function handleAnalyticsToggle(value: boolean) {
    setSettings(prev => ({ ...prev, analyticsOptOut: value }));
    await updateAnalyticsOptOut(value);
  }

  async function handleDownloadData() {
    setDownloading(true);
    try {
      const result = await downloadMyData();

      if (result.success && result.data) {
        // Convert to JSON and share/download
        const dataJson = JSON.stringify(result.data, null, 2);

        Alert.alert(
          'Data Export Ready',
          'Your data has been compiled. In a production app, this would be downloaded or shared.',
          [{ text: 'OK' }]
        );

        // In production, you would use Sharing or FileSystem to save the file
        console.log('Exported data:', dataJson.substring(0, 500) + '...');
      } else {
        Alert.alert('Error', result.error || 'Failed to export data');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setDownloading(false);
    }
  }

  function openPrivacyPolicy() {
    Linking.openURL('https://k12buddy.com/privacy');
  }

  function openTermsOfService() {
    Linking.openURL('https://k12buddy.com/terms');
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
        <Text style={styles.title}>Privacy Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Data Collection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Collection</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingIcon}>📍</Text>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Location Sharing</Text>
                <Text style={styles.settingDescription}>
                  Share approximate location for personalized content
                </Text>
              </View>
            </View>
            <Switch
              value={settings.locationConsent}
              onValueChange={handleLocationToggle}
              trackColor={{ false: '#D1D5DB', true: '#A5B4FC' }}
              thumbColor={settings.locationConsent ? '#4F46E5' : '#9CA3AF'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingIcon}>📊</Text>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Opt Out of Analytics</Text>
                <Text style={styles.settingDescription}>
                  Stop sharing usage data to improve K12Buddy
                </Text>
              </View>
            </View>
            <Switch
              value={settings.analyticsOptOut}
              onValueChange={handleAnalyticsToggle}
              trackColor={{ false: '#D1D5DB', true: '#A5B4FC' }}
              thumbColor={settings.analyticsOptOut ? '#4F46E5' : '#9CA3AF'}
            />
          </View>
        </View>

        {/* Your Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Data</Text>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleDownloadData}
            disabled={downloading}
          >
            <Text style={styles.actionIcon}>📥</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionLabel}>
                {downloading ? 'Preparing Download...' : 'Download My Data'}
              </Text>
              <Text style={styles.actionDescription}>
                Get a copy of all your K12Buddy data
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push('/settings/devices')}
          >
            <Text style={styles.actionIcon}>📱</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionLabel}>Manage Devices</Text>
              <Text style={styles.actionDescription}>
                View and remove devices with access to your account
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Data Retention */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How We Handle Your Data</Text>

          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🔒</Text>
            <Text style={styles.infoText}>
              Your data is encrypted and stored securely
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🗑️</Text>
            <Text style={styles.infoText}>
              Chat history is retained for 90 days
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🚫</Text>
            <Text style={styles.infoText}>
              We never sell your personal information
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>👶</Text>
            <Text style={styles.infoText}>
              COPPA compliant for users under 13
            </Text>
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>

          <TouchableOpacity style={styles.actionItem} onPress={openPrivacyPolicy}>
            <Text style={styles.actionIcon}>📜</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionLabel}>Privacy Policy</Text>
              <Text style={styles.actionDescription}>
                How we collect and use your information
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={openTermsOfService}>
            <Text style={styles.actionIcon}>📋</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionLabel}>Terms of Service</Text>
              <Text style={styles.actionDescription}>
                Rules and guidelines for using K12Buddy
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
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
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  settingIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  actionArrow: {
    fontSize: 20,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  infoSection: {
    backgroundColor: '#EEF2FF',
    margin: 16,
    padding: 16,
    borderRadius: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4338CA',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#4338CA',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 32,
  },
});
