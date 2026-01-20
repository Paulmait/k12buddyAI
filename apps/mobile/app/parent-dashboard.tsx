import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function ParentDashboardScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.icon}>👨‍👩‍👧‍👦</Text>
          <Text style={styles.title}>Parent Dashboard</Text>
          <Text style={styles.subtitle}>
            Monitor your child&apos;s learning progress
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardIcon}>📊</Text>
          <Text style={styles.cardTitle}>Activity Summary</Text>
          <Text style={styles.cardText}>Coming soon - view your child&apos;s learning activity</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardIcon}>🏆</Text>
          <Text style={styles.cardTitle}>Achievements</Text>
          <Text style={styles.cardText}>Coming soon - see badges and milestones</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardIcon}>⚙️</Text>
          <Text style={styles.cardTitle}>Settings</Text>
          <Text style={styles.cardText}>Coming soon - manage parental controls</Text>
        </View>
      </ScrollView>

      <View style={styles.navigation}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  cardText: {
    fontSize: 14,
    color: '#6B7280',
  },
  navigation: {
    padding: 24,
  },
  button: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
