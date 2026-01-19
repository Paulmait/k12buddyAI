/**
 * Admin Dashboard
 * Moderation and analytics panel for administrators
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

// Types
interface ContentReport {
  id: string;
  reporterId: string;
  reporterName: string;
  contentType: string;
  contentId: string;
  reason: string;
  description: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
}

interface AnalyticsSummary {
  totalUsers: number;
  activeToday: number;
  messagesThisWeek: number;
  avgSessionLength: number;
  newUsersThisWeek: number;
  flaggedContent: number;
}

interface AdminUser {
  id: string;
  role: 'admin' | 'moderator';
}

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'users'>('overview');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [processingReport, setProcessingReport] = useState<string | null>(null);

  // Check admin status
  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        Alert.alert('Access Denied', 'You do not have admin privileges.');
        router.replace('/');
        return;
      }

      setIsAdmin(true);
      loadData();
    } catch (error) {
      console.error('Admin check error:', error);
      router.replace('/');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAnalytics(),
        loadReports(),
      ]);
    } catch (error) {
      console.error('Load data error:', error);
    }
    setLoading(false);
  };

  const loadAnalytics = async () => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Get active today
    const { count: activeToday } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('last_message_at', `${today}T00:00:00`);

    // Get messages this week
    const { count: messagesThisWeek } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo);

    // Get new users this week
    const { count: newUsersThisWeek } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo);

    // Get flagged content
    const { count: flaggedContent } = await supabase
      .from('content_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    setAnalytics({
      totalUsers: totalUsers || 0,
      activeToday: activeToday || 0,
      messagesThisWeek: messagesThisWeek || 0,
      avgSessionLength: 0, // Would need to calculate from session data
      newUsersThisWeek: newUsersThisWeek || 0,
      flaggedContent: flaggedContent || 0,
    });
  };

  const loadReports = async () => {
    const { data, error } = await supabase
      .from('content_reports')
      .select(`
        id,
        reporter_id,
        content_type,
        content_id,
        reason,
        description,
        status,
        created_at,
        profiles!reporter_id(display_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setReports(data.map(r => ({
        id: r.id,
        reporterId: r.reporter_id,
        reporterName: (r.profiles as { display_name?: string })?.display_name || 'Anonymous',
        contentType: r.content_type,
        contentId: r.content_id,
        reason: r.reason,
        description: r.description,
        status: r.status as 'pending' | 'resolved' | 'dismissed',
        createdAt: r.created_at,
      })));
    }
  };

  const handleReportAction = async (reportId: string, action: 'resolve' | 'dismiss') => {
    setProcessingReport(reportId);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('content_reports')
        .update({
          status: action === 'resolve' ? 'resolved' : 'dismissed',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: `report_${action}`,
        resource_type: 'content_report',
        resource_id: reportId,
      });

      setReports(reports.filter(r => r.id !== reportId));
      Alert.alert('Success', `Report ${action}d successfully`);
    } catch (error) {
      console.error('Report action error:', error);
      Alert.alert('Error', 'Failed to process report');
    }
    setProcessingReport(null);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  if (!isAdmin || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading admin panel...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['overview', 'reports', 'users'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'overview' && analytics && (
          <View style={styles.statsGrid}>
            <StatCard title="Total Users" value={analytics.totalUsers.toLocaleString()} />
            <StatCard title="Active Today" value={analytics.activeToday.toLocaleString()} />
            <StatCard title="Messages This Week" value={analytics.messagesThisWeek.toLocaleString()} />
            <StatCard title="New Users (7d)" value={analytics.newUsersThisWeek.toLocaleString()} />
            <StatCard
              title="Pending Reports"
              value={analytics.flaggedContent.toLocaleString()}
              alert={analytics.flaggedContent > 0}
            />
          </View>
        )}

        {activeTab === 'reports' && (
          <View style={styles.reportsList}>
            {reports.length === 0 ? (
              <Text style={styles.emptyText}>No pending reports</Text>
            ) : (
              reports.map(report => (
                <View key={report.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportType}>{report.contentType}</Text>
                    <Text style={styles.reportDate}>
                      {new Date(report.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.reportReason}>{report.reason}</Text>
                  {report.description && (
                    <Text style={styles.reportDescription}>{report.description}</Text>
                  )}
                  <Text style={styles.reportedBy}>Reported by: {report.reporterName}</Text>
                  <View style={styles.reportActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.resolveButton]}
                      onPress={() => handleReportAction(report.id, 'resolve')}
                      disabled={processingReport === report.id}
                    >
                      {processingReport === report.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.actionButtonText}>Resolve</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.dismissButton]}
                      onPress={() => handleReportAction(report.id, 'dismiss')}
                      disabled={processingReport === report.id}
                    >
                      <Text style={styles.actionButtonText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'users' && (
          <View style={styles.usersSection}>
            <Text style={styles.sectionTitle}>User Management</Text>
            <Text style={styles.comingSoon}>
              User search and management coming soon.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => Alert.alert('Info', 'User management features are in development.')}
            >
              <Text style={styles.primaryButtonText}>Search Users</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Stat Card Component
function StatCard({ title, value, alert = false }: { title: string; value: string; alert?: boolean }) {
  return (
    <View style={[styles.statCard, alert && styles.alertCard]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#6366F1',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#6366F1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#6366F1',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  alertCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: '#64748B',
  },
  reportsList: {
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 16,
    paddingVertical: 40,
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reportType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
    textTransform: 'uppercase',
  },
  reportDate: {
    fontSize: 12,
    color: '#64748B',
  },
  reportReason: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  reportDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  reportedBy: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
  },
  reportActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  resolveButton: {
    backgroundColor: '#22C55E',
  },
  dismissButton: {
    backgroundColor: '#64748B',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  usersSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
  },
  comingSoon: {
    color: '#64748B',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
