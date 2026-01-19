import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { getStudentProfile, getCurrentUser } from '../../src/lib/supabase';
import type { Student } from '@k12buddy/shared';

export default function HomeScreen() {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const gradeDisplay = student?.grade === 'K' ? 'Kindergarten' : `Grade ${student?.grade}`;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back!</Text>
        {student && (
          <Text style={styles.gradeInfo}>{gradeDisplay} • {student.state}</Text>
        )}
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <Link href="/(tabs)/chat" asChild>
          <TouchableOpacity style={styles.actionCard}>
            <Text style={styles.actionIcon}>💬</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Ask a Question</Text>
              <Text style={styles.actionDescription}>
                Get help with your homework or understand a concept
              </Text>
            </View>
          </TouchableOpacity>
        </Link>

        <Link href="/(tabs)/scan" asChild>
          <TouchableOpacity style={styles.actionCard}>
            <Text style={styles.actionIcon}>📷</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Scan Page</Text>
              <Text style={styles.actionDescription}>
                Take a photo of your textbook or worksheet
              </Text>
            </View>
          </TouchableOpacity>
        </Link>

        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionIcon}>📚</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Practice Problems</Text>
            <Text style={styles.actionDescription}>
              Get extra practice on topics you&apos;re learning
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.tips}>
        <Text style={styles.sectionTitle}>Study Tips</Text>
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>
            📌 Try the &quot;Hint&quot; mode when you want to work through problems yourself with
            gentle guidance!
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    backgroundColor: '#4F46E5',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
  quickActions: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  tips: {
    padding: 20,
    paddingTop: 0,
  },
  tipCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
  },
  tipText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
});
