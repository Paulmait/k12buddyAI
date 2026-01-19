import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, getCurrentUser, getStudentProfile } from '../../src/lib/supabase';
import { useGamification } from '../../src/contexts/GamificationContext';
import { getUserProfile, signOut } from '../../src/lib/accountService';
import { useResponsive } from '../../src/hooks/useResponsive';
import XPBar from '../../src/components/XPBar';
import StreakCounter from '../../src/components/StreakCounter';
import { BadgeCard } from '../../src/components/BadgeCard';
import type { Student } from '@k12buddy/shared';

interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  earned_at: string;
}

interface UserProfileData {
  display_name?: string;
  avatar_url?: string;
  account_type?: string;
}

export default function ProfileScreen() {
  const [student, setStudent] = useState<Student | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  const { xp, streak, badges, recentXP } = useGamification();
  const { isPhone, isTablet, getColumns } = useResponsive();

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const user = await getCurrentUser();
      if (user) {
        const [studentProfile, userProfile] = await Promise.all([
          getStudentProfile(user.id),
          getUserProfile(),
        ]);
        setStudent(studentProfile);
        setProfile(userProfile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const gradeDisplay = student?.grade === 'K' ? 'Kindergarten' : `Grade ${student?.grade}`;
  const avatarEmoji = profile?.avatar_url || xp.levelIcon;
  const displayName = profile?.display_name || xp.levelTitle;

  // Responsive badge grid columns
  const badgeColumns = getColumns(3, 4, 5);
  const badgeWidth = `${Math.floor(100 / badgeColumns) - 2}%`;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Lv.{xp.level}</Text>
          </View>
        </View>
        <Text style={styles.levelTitle}>{displayName}</Text>
        <Text style={styles.gradeText}>{gradeDisplay}</Text>
        <Text style={styles.locationText}>
          {student?.county ? `${student.county}, ` : ''}{student?.state}
        </Text>

        {/* Edit Profile Button */}
        <TouchableOpacity
          style={styles.editProfileButton}
          onPress={() => router.push('/profile/edit')}
        >
          <Text style={styles.editProfileText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsSection}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{xp.total.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total XP</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{streak.current}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{badges.length}</Text>
            <Text style={styles.statLabel}>Badges</Text>
          </View>
        </View>
      </View>

      {/* XP Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Level Progress</Text>
        <XPBar
          currentXP={xp.total}
          xpToNextLevel={xp.xpToNextLevel}
          level={xp.level}
          levelTitle={xp.levelTitle}
          levelIcon={xp.levelIcon}
        />
      </View>

      {/* Streak */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Study Streak</Text>
        <StreakCounter
          currentStreak={streak.current}
          longestStreak={streak.longest}
          lastActivityDate={streak.lastActivity || undefined}
        />
      </View>

      {/* Badges */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Badges Earned</Text>
          <Text style={styles.sectionCount}>{badges.length}</Text>
        </View>

        {badges.length > 0 ? (
          <View style={styles.badgesGrid}>
            {badges.map((badge) => (
              <TouchableOpacity
                key={badge.id}
                style={[styles.badgeWrapper, { width: badgeWidth as any }]}
                onPress={() => setSelectedBadge(badge)}
              >
                <BadgeCard badge={badge} earned size="small" />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBadges}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={styles.emptyTitle}>No badges yet</Text>
            <Text style={styles.emptyText}>
              Complete challenges and reach milestones to earn badges!
            </Text>
          </View>
        )}
      </View>

      {/* Recent XP */}
      {recentXP.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityList}>
            {recentXP.slice(0, 5).map((event, index) => (
              <View key={index} style={styles.activityItem}>
                <View style={styles.activityDot} />
                <View style={styles.activityContent}>
                  <Text style={styles.activityDescription}>{event.description}</Text>
                  <Text style={styles.activityTime}>
                    {new Date(event.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.activityXP}>+{event.xp_amount} XP</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Settings */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => router.push('/settings/account')}
        >
          <Text style={styles.settingIcon}>👤</Text>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Account Settings</Text>
            <Text style={styles.settingValue}>Manage your account</Text>
          </View>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => router.push('/settings/devices')}
        >
          <Text style={styles.settingIcon}>📱</Text>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>My Devices</Text>
            <Text style={styles.settingValue}>View registered devices</Text>
          </View>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => router.push('/settings/privacy')}
        >
          <Text style={styles.settingIcon}>🔒</Text>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Privacy & Data</Text>
            <Text style={styles.settingValue}>Manage your data</Text>
          </View>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingIcon}>📚</Text>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>My Textbooks</Text>
            <Text style={styles.settingValue}>0 textbooks</Text>
          </View>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingIcon}>🎯</Text>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Learning Preferences</Text>
            <Text style={styles.settingValue}>Average difficulty</Text>
          </View>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingIcon}>🔔</Text>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Text style={styles.settingValue}>Enabled</Text>
          </View>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Support */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Support</Text>

        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingIcon}>❓</Text>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Help Center</Text>
          </View>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingIcon}>💬</Text>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Contact Us</Text>
          </View>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Text style={styles.settingIcon}>📜</Text>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Privacy Policy</Text>
          </View>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>K-12 Buddy v0.1.0</Text>

      {/* Badge Detail Modal */}
      <Modal
        visible={selectedBadge !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBadge(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedBadge(null)}
        >
          <View style={styles.modalContent}>
            {selectedBadge && (
              <BadgeCard badge={selectedBadge} earned size="large" />
            )}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setSelectedBadge(null)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#4F46E5',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarEmoji: {
    fontSize: 44,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#FCD34D',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  levelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  gradeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#C7D2FE',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    color: '#A5B4FC',
    marginBottom: 12,
  },
  editProfileButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  editProfileText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsSection: {
    marginTop: -20,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeWrapper: {},
  emptyBadges: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  activityList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4F46E5',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    color: '#1F2937',
  },
  activityTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  activityXP: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  settingsSection: {
    backgroundColor: '#fff',
    marginBottom: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    paddingTop: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  settingIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1F2937',
  },
  settingValue: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  settingArrow: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  signOutButton: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  version: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  modalClose: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
});
