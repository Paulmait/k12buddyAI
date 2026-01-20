import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';

export default function PrivacySettingsScreen() {
  const [locationConsent, setLocationConsent] = useState(false);
  const [analyticsOptOut, setAnalyticsOptOut] = useState(false);

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
              value={locationConsent}
              onValueChange={setLocationConsent}
              trackColor={{ false: '#D1D5DB', true: '#A5B4FC' }}
              thumbColor={locationConsent ? '#4F46E5' : '#9CA3AF'}
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
              value={analyticsOptOut}
              onValueChange={setAnalyticsOptOut}
              trackColor={{ false: '#D1D5DB', true: '#A5B4FC' }}
              thumbColor={analyticsOptOut ? '#4F46E5' : '#9CA3AF'}
            />
          </View>
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

          <TouchableOpacity style={styles.actionItem}>
            <Text style={styles.actionIcon}>📜</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionLabel}>Privacy Policy</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}>
            <Text style={styles.actionIcon}>📋</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionLabel}>Terms of Service</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  },
  actionArrow: {
    fontSize: 20,
    color: '#9CA3AF',
  },
});
