import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../src/lib/supabase';

interface ParentConsentProps {
  studentId: string;
  studentEmail: string;
  onConsentSent?: () => void;
}

export default function ParentConsentScreen() {
  const [parentEmail, setParentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [consentSent, setConsentSent] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  async function handleSendConsent() {
    if (!parentEmail.trim()) {
      Alert.alert('Error', 'Please enter your parent or guardian\'s email address');
      return;
    }

    if (!validateEmail(parentEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in first');
        return;
      }

      // Update profile with parent email
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          parent_email: parentEmail,
          consent_version: '1.0',
        })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      // In a real implementation, this would:
      // 1. Send an email to the parent via a backend function
      // 2. Include a verification link with a unique token
      // 3. The link would verify the parent and update parent_verified_at

      // For now, we'll simulate sending the email
      console.log(`Consent email would be sent to: ${parentEmail}`);

      setConsentSent(true);
    } catch (error) {
      console.error('Error sending consent:', error);
      Alert.alert(
        'Error',
        'Failed to send consent request. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (consentSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>📧</Text>
          <Text style={styles.successTitle}>Consent Request Sent!</Text>
          <Text style={styles.successText}>
            We've sent a consent request to your parent or guardian at:
          </Text>
          <Text style={styles.emailDisplay}>{parentEmail}</Text>
          <Text style={styles.successText}>
            Ask them to check their email and click the verification link.
            Once they approve, you'll have full access to K-12 Buddy!
          </Text>

          <View style={styles.whileWaitingCard}>
            <Text style={styles.whileWaitingTitle}>While you wait...</Text>
            <Text style={styles.whileWaitingText}>
              You can still explore the app with limited features. Some features
              will be unlocked once your parent approves.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.continueButtonText}>Continue to App</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={() => setConsentSent(false)}
          >
            <Text style={styles.resendButtonText}>Send to different email</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.emoji}>👨‍👩‍👧‍👦</Text>
            <Text style={styles.title}>Parent Consent Required</Text>
            <Text style={styles.subtitle}>
              Because you're under 13, we need permission from a parent or guardian
              before you can use K-12 Buddy.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Why do we need this?</Text>
            <Text style={styles.cardText}>
              K-12 Buddy follows COPPA (Children's Online Privacy Protection Act)
              to keep you safe online. This means we need your parent or guardian's
              permission before you can use all features.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Parent or Guardian's Email</Text>
            <TextInput
              style={styles.input}
              value={parentEmail}
              onChangeText={setParentEmail}
              placeholder="parent@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
            />
            <Text style={styles.hint}>
              We'll send them an email to verify their consent
            </Text>
          </View>

          <View style={styles.privacyNote}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={styles.privacyText}>
              We only use this email for consent verification. We never share
              your information with third parties.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.sendButton, loading && styles.sendButtonDisabled]}
            onPress={handleSendConsent}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>Send Consent Request</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  hint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },
  privacyNote: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  privacyIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  sendButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  backButton: {
    padding: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#6B7280',
  },
  // Success state styles
  successContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  successText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  emailDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 16,
  },
  whileWaitingCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 24,
    width: '100%',
  },
  whileWaitingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 8,
  },
  whileWaitingText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  resendButton: {
    padding: 12,
  },
  resendButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
