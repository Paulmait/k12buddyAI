import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { getStudentProfile, getCurrentUser } from '../../src/lib/supabase';
import { useGamification } from '../../src/contexts/GamificationContext';
import XPBar from '../../src/components/XPBar';
import StreakCounter from '../../src/components/StreakCounter';
import type { Student } from '../../src/types';

export default function HomeScreen() {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    isLoading: gamificationLoading,
    xp,
    streak,
    challenges,
  } = useGamification();

  useEffect(() => {
    loadStudent();
  }, []);

  async function loadStudent() {
    try {
      const user = await getCurrentUser();
      if (user) {
        const profile = await getStudentProfile(user.id);
        setStudent(profile);
      }
    } catch (error) {
      console.error('Error loading student:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || gamificationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const gradeDisplay = student?.grade === 'K' ? 'Kindergarten' : `Grade ${student?.grade}`;

  // Filter incomplete daily challenges
  const dailyChallenges = challenges.filter(c => c.type === 'daily' && !c.completed);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header with gradient effect */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Welcome back!</Text>
              {student && (
                <Text style={styles.gradeInfo}>{gradeDisplay} • {student.state}</Text>
              )}
            </View>
            <StreakCounter
              currentStreak={streak.current}
              longestStreak={streak.longest}
              lastActivityDate={streak.lastActivity || undefined}
              compact
            />
          </View>
        </View>
      </View>

      {/* XP Progress Card */}
      <View style={styles.xpSection}>
        <XPBar
          currentXP={xp.total}
          xpToNextLevel={xp.xpToNextLevel}
          level={xp.level}
          levelTitle={xp.levelTitle}
          levelIcon={xp.levelIcon}
        />
      </View>

      {/* Daily Challenges */}
      {dailyChallenges.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Challenges</Text>
            <Text style={styles.sectionSubtitle}>Complete for bonus XP!</Text>
          </View>

          {dailyChallenges.slice(0, 3).map((challenge) => (
            <View key={challenge.id} style={styles.challengeCard}>
              <View style={styles.challengeInfo}>
                <Text style={styles.challengeTitle}>{challenge.title}</Text>
                <Text style={styles.challengeDescription}>{challenge.description}</Text>
                <View style={styles.challengeProgress}>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${Math.min(
                            (challenge.progress / (challenge.criteria?.count || 1)) * 100,
                            100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {challenge.progress}/{challenge.criteria?.count || 1}
                  </Text>
                </View>
              </View>
              <View style={styles.challengeReward}>
                <Text style={styles.rewardAmount}>+{challenge.xp_reward}</Text>
                <Text style={styles.rewardLabel}>XP</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <View style={styles.actionsGrid}>
          <Link href="/(tabs)/chat" asChild>
            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIconBg, { backgroundColor: '#EEF2FF' }]}>
                <Text style={styles.actionIcon}>💬</Text>
              </View>
              <Text style={styles.actionTitle}>Ask a Question</Text>
              <Text style={styles.actionXP}>+5 XP</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/(tabs)/scan" asChild>
            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.actionIcon}>📷</Text>
              </View>
              <Text style={styles.actionTitle}>Scan Page</Text>
              <Text style={styles.actionXP}>+10 XP</Text>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.actionIconBg, { backgroundColor: '#ECFDF5' }]}>
              <Text style={styles.actionIcon}>📚</Text>
            </View>
            <Text style={styles.actionTitle}>Practice</Text>
            <Text style={styles.actionXP}>+25 XP</Text>
          </TouchableOpacity>

          <Link href="/(tabs)/profile" asChild>
            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIconBg, { backgroundColor: '#FDF4FF' }]}>
                <Text style={styles.actionIcon}>🏆</Text>
              </View>
              <Text style={styles.actionTitle}>Badges</Text>
              <Text style={styles.actionXP}>View All</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* Study Tips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Study Tips</Text>
        <View style={styles.tipCard}>
          <Text style={styles.tipEmoji}>💡</Text>
          <Text style={styles.tipText}>
            Try the &quot;Hint&quot; mode when you want to work through problems yourself with
            gentle guidance!
          </Text>
        </View>
      </View>

      {/* Spacing at bottom */}
      <View style={{ height: 20 }} />
    </ScrollView>
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
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#4F46E5',
    paddingTop: 20,
    paddingBottom: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  gradeInfo: {
    fontSize: 16,
    color: '#C7D2FE',
  },
  xpSection: {
    paddingHorizontal: 20,
    marginTop: -40,
    marginBottom: 20,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  // Challenge styles
  challengeCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  challengeInfo: {
    flex: 1,
    marginRight: 12,
  },
  challengeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  challengeDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  challengeProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    minWidth: 30,
    textAlign: 'right',
  },
  challengeReward: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rewardAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  rewardLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  // Action grid styles
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionIcon: {
    fontSize: 28,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  actionXP: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4F46E5',
  },
  // Tip styles
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  tipEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
});
