import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../src/lib/supabase';

interface StudentStats {
  total_xp: number;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  total_messages: number;
  total_scans: number;
  badges_earned: number;
  last_activity: string | null;
}

interface RecentActivity {
  id: string;
  type: 'chat' | 'scan' | 'badge';
  description: string;
  created_at: string;
}

interface SubjectBreakdown {
  subject: string;
  question_count: number;
  percentage: number;
}

export default function ParentDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [subjectBreakdown, setSubjectBreakdown] = useState<SubjectBreakdown[]>([]);
  const [weeklyStudyMinutes, setWeeklyStudyMinutes] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get student profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, grade')
        .eq('id', user.id)
        .single();

      if (profile) {
        setStudentName(profile.display_name || 'Your Student');
      }

      // Get XP and level stats
      const { data: xpData } = await supabase
        .from('student_xp')
        .select('total_xp, current_level')
        .eq('student_id', user.id)
        .single();

      // Get streak data
      const { data: streakData } = await supabase
        .from('student_streaks')
        .select('current_streak, longest_streak, last_activity_date')
        .eq('student_id', user.id)
        .single();

      // Get message count
      const { count: messageCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', user.id); // This would need proper session lookup

      // Get badge count
      const { count: badgeCount } = await supabase
        .from('student_badges')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', user.id);

      setStats({
        total_xp: xpData?.total_xp || 0,
        current_level: xpData?.current_level || 1,
        current_streak: streakData?.current_streak || 0,
        longest_streak: streakData?.longest_streak || 0,
        total_messages: messageCount || 0,
        total_scans: 0, // Would need OCR session tracking
        badges_earned: badgeCount || 0,
        last_activity: streakData?.last_activity_date || null,
      });

      // Get recent XP events as activity
      const { data: xpEvents } = await supabase
        .from('xp_events')
        .select('id, xp_amount, source, description, created_at')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (xpEvents) {
        const activities: RecentActivity[] = xpEvents.map(event => ({
          id: event.id,
          type: event.source === 'scan' ? 'scan' : event.source === 'badge' ? 'badge' : 'chat',
          description: event.description || `Earned ${event.xp_amount} XP from ${event.source}`,
          created_at: event.created_at,
        }));
        setRecentActivity(activities);
      }

      // Mock subject breakdown (would need actual analytics tracking)
      setSubjectBreakdown([
        { subject: 'Math', question_count: 45, percentage: 50 },
        { subject: 'Science', question_count: 27, percentage: 30 },
        { subject: 'English', question_count: 18, percentage: 20 },
      ]);

      // Mock weekly study time
      setWeeklyStudyMinutes(145);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Parent Dashboard</Text>
        </View>

        {/* Student Info */}
        <View style={styles.studentCard}>
          <View style={styles.studentAvatar}>
            <Text style={styles.studentAvatarText}>
              {studentName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{studentName}</Text>
            <Text style={styles.studentLevel}>Level {stats?.current_level || 1}</Text>
          </View>
          <View style={styles.xpBadge}>
            <Text style={styles.xpValue}>{stats?.total_xp || 0}</Text>
            <Text style={styles.xpLabel}>XP</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="🔥"
            value={stats?.current_streak || 0}
            label="Day Streak"
            color="#F59E0B"
          />
          <StatCard
            icon="🏆"
            value={stats?.badges_earned || 0}
            label="Badges"
            color="#8B5CF6"
          />
          <StatCard
            icon="💬"
            value={stats?.total_messages || 0}
            label="Questions"
            color="#10B981"
          />
          <StatCard
            icon="⏱️"
            value={weeklyStudyMinutes}
            label="Min This Week"
            color="#3B82F6"
          />
        </View>

        {/* Subject Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subject Focus</Text>
          <View style={styles.subjectBreakdownContainer}>
            {subjectBreakdown.map((subject, index) => (
              <View key={index} style={styles.subjectRow}>
                <View style={styles.subjectInfo}>
                  <Text style={styles.subjectName}>{subject.subject}</Text>
                  <Text style={styles.subjectCount}>
                    {subject.question_count} questions
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      { width: `${subject.percentage}%` },
                    ]}
                  />
                </View>
                <Text style={styles.subjectPercentage}>{subject.percentage}%</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentActivity.length > 0 ? (
            <View style={styles.activityList}>
              {recentActivity.map((activity) => (
                <View key={activity.id} style={styles.activityItem}>
                  <Text style={styles.activityIcon}>
                    {activity.type === 'badge' ? '🏆' : activity.type === 'scan' ? '📸' : '💬'}
                  </Text>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityDescription}>
                      {activity.description}
                    </Text>
                    <Text style={styles.activityTime}>
                      {formatRelativeTime(activity.created_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyActivityText}>
                No recent activity yet. Encourage your student to start learning!
              </Text>
            </View>
          )}
        </View>

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsSectionTitle}>Tips for Parents</Text>
          <View style={styles.tipCard}>
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.tipText}>
              Ask your child about what they learned today to reinforce their knowledge.
            </Text>
          </View>
          <View style={styles.tipCard}>
            <Text style={styles.tipIcon}>🎯</Text>
            <Text style={styles.tipText}>
              Help them set a daily learning goal to maintain their streak.
            </Text>
          </View>
          <View style={styles.tipCard}>
            <Text style={styles.tipIcon}>🌟</Text>
            <Text style={styles.tipText}>
              Celebrate their achievements when they earn new badges!
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
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
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4F46E5',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  studentAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  studentInfo: {
    flex: 1,
    marginLeft: 16,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  studentLevel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  xpBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  xpValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  xpLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 4,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  subjectBreakdownContainer: {
    gap: 12,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectInfo: {
    width: 100,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  subjectCount: {
    fontSize: 11,
    color: '#6B7280',
  },
  progressBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  subjectPercentage: {
    width: 40,
    fontSize: 14,
    fontWeight: '500',
    color: '#4F46E5',
    textAlign: 'right',
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activityIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  activityTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  emptyActivity: {
    padding: 24,
    alignItems: 'center',
  },
  emptyActivityText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  tipsSection: {
    margin: 16,
    marginBottom: 32,
  },
  tipsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  tipIcon: {
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
