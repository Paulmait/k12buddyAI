import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../src/lib/supabase';
import { markProfileCompleted } from '../../src/lib/accountService';

const ONBOARDING_COMPLETE_KEY = 'k12buddy_onboarding_complete';

interface OnboardingState {
  childEmail: string;
  linkCode: string;
  notificationPreferences: {
    dailyProgress: boolean;
    weeklyReport: boolean;
    achievements: boolean;
    concerns: boolean;
  };
}

export default function ParentOnboardingScreen() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<OnboardingState>({
    childEmail: '',
    linkCode: '',
    notificationPreferences: {
      dailyProgress: true,
      weeklyReport: true,
      achievements: true,
      concerns: true,
    },
  });
  const [saving, setSaving] = useState(false);
  const [linkMethod, setLinkMethod] = useState<'email' | 'code'>('email');

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = (nextStep: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => setStep(nextStep), 150);
  };

  const handleComplete = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Update profile with parent preferences
        await supabase
          .from('profiles')
          .update({
            onboarding_completed: true,
            profile_completed: true,
          })
          .eq('id', user.id);

        // If child email provided, attempt to link
        if (state.childEmail) {
          // Find child by email (this would need a proper linking mechanism)
          // For now, just store the intent
          console.log('Would link to child:', state.childEmail);
        }
      }

      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      await markProfileCompleted();

      router.replace('/parent-dashboard');
    } catch (error) {
      console.error('Error completing parent onboarding:', error);
      Alert.alert('Error', 'Failed to complete setup. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: // Welcome
        return true;
      case 1: // Link Child
        return true; // Optional step
      case 2: // Notifications
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (step < 2) {
      animateTransition(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      animateTransition(step - 1);
    }
  };

  const toggleNotification = (key: keyof typeof state.notificationPreferences) => {
    setState(prev => ({
      ...prev,
      notificationPreferences: {
        ...prev.notificationPreferences,
        [key]: !prev.notificationPreferences[key],
      },
    }));
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <WelcomeStep />;
      case 1:
        return (
          <LinkChildStep
            childEmail={state.childEmail}
            linkCode={state.linkCode}
            linkMethod={linkMethod}
            onEmailChange={(email) => setState(prev => ({ ...prev, childEmail: email }))}
            onCodeChange={(code) => setState(prev => ({ ...prev, linkCode: code }))}
            onMethodChange={setLinkMethod}
          />
        );
      case 2:
        return (
          <NotificationsStep
            preferences={state.notificationPreferences}
            onToggle={toggleNotification}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i <= step && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {renderStep()}
      </Animated.View>

      {/* Navigation */}
      <View style={styles.navigation}>
        {step > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            !canProceed() && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!canProceed() || saving}
        >
          <Text style={styles.nextButtonText}>
            {step === 2 ? (saving ? 'Saving...' : 'Complete Setup') : step === 1 ? 'Skip' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function WelcomeStep() {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.welcomeIcon}>👨‍👩‍👧‍👦</Text>
      <Text style={styles.welcomeTitle}>Welcome, Parent!</Text>
      <Text style={styles.welcomeSubtitle}>
        K12Buddy helps you stay connected to your child's learning journey.
      </Text>
      <View style={styles.featureList}>
        <FeatureItem icon="📊" text="Monitor learning progress" />
        <FeatureItem icon="🏆" text="Celebrate achievements together" />
        <FeatureItem icon="📱" text="Get notified of activity" />
        <FeatureItem icon="🔒" text="Manage privacy settings" />
      </View>
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function LinkChildStep({
  childEmail,
  linkCode,
  linkMethod,
  onEmailChange,
  onCodeChange,
  onMethodChange,
}: {
  childEmail: string;
  linkCode: string;
  linkMethod: 'email' | 'code';
  onEmailChange: (email: string) => void;
  onCodeChange: (code: string) => void;
  onMethodChange: (method: 'email' | 'code') => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Link Your Child's Account</Text>
      <Text style={styles.stepSubtitle}>
        Connect with your child to monitor their learning progress. You can also do this later.
      </Text>

      {/* Method Toggle */}
      <View style={styles.methodToggle}>
        <TouchableOpacity
          style={[
            styles.methodButton,
            linkMethod === 'email' && styles.methodButtonActive,
          ]}
          onPress={() => onMethodChange('email')}
        >
          <Text
            style={[
              styles.methodButtonText,
              linkMethod === 'email' && styles.methodButtonTextActive,
            ]}
          >
            By Email
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.methodButton,
            linkMethod === 'code' && styles.methodButtonActive,
          ]}
          onPress={() => onMethodChange('code')}
        >
          <Text
            style={[
              styles.methodButtonText,
              linkMethod === 'code' && styles.methodButtonTextActive,
            ]}
          >
            By Code
          </Text>
        </TouchableOpacity>
      </View>

      {linkMethod === 'email' ? (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Child's Email Address</Text>
          <TextInput
            style={styles.input}
            value={childEmail}
            onChangeText={onEmailChange}
            placeholder="child@example.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.helperText}>
            We'll send a link request to this email address.
          </Text>
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Link Code</Text>
          <TextInput
            style={styles.input}
            value={linkCode}
            onChangeText={onCodeChange}
            placeholder="ABC123"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            maxLength={6}
          />
          <Text style={styles.helperText}>
            Ask your child for their 6-character link code from their profile.
          </Text>
        </View>
      )}
    </View>
  );
}

function NotificationsStep({
  preferences,
  onToggle,
}: {
  preferences: {
    dailyProgress: boolean;
    weeklyReport: boolean;
    achievements: boolean;
    concerns: boolean;
  };
  onToggle: (key: keyof typeof preferences) => void;
}) {
  const notifications = [
    {
      key: 'dailyProgress' as const,
      icon: '📈',
      title: 'Daily Progress',
      description: 'Get a daily summary of your child\'s learning activity',
    },
    {
      key: 'weeklyReport' as const,
      icon: '📊',
      title: 'Weekly Report',
      description: 'Receive detailed weekly progress reports',
    },
    {
      key: 'achievements' as const,
      icon: '🏆',
      title: 'Achievements',
      description: 'Be notified when your child earns badges or reaches milestones',
    },
    {
      key: 'concerns' as const,
      icon: '⚠️',
      title: 'Learning Concerns',
      description: 'Get alerts if your child is struggling with a topic',
    },
  ];

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Notification Preferences</Text>
      <Text style={styles.stepSubtitle}>
        Choose what updates you'd like to receive about your child's progress.
      </Text>

      <View style={styles.notificationList}>
        {notifications.map(notif => (
          <TouchableOpacity
            key={notif.key}
            style={[
              styles.notificationItem,
              preferences[notif.key] && styles.notificationItemActive,
            ]}
            onPress={() => onToggle(notif.key)}
          >
            <Text style={styles.notificationIcon}>{notif.icon}</Text>
            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>{notif.title}</Text>
              <Text style={styles.notificationDescription}>{notif.description}</Text>
            </View>
            <View
              style={[
                styles.checkbox,
                preferences[notif.key] && styles.checkboxChecked,
              ]}
            >
              {preferences[notif.key] && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  progressDotActive: {
    backgroundColor: '#4F46E5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepContainer: {
    flex: 1,
  },
  // Welcome step
  welcomeIcon: {
    fontSize: 64,
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1F2937',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6B7280',
    lineHeight: 24,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  featureList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#374151',
  },
  // Step common
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 24,
  },
  // Link child step
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  methodButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  methodButtonTextActive: {
    color: '#4F46E5',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  // Notifications step
  notificationList: {
    gap: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  notificationItemActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  notificationIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkboxChecked: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Navigation
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 24,
    gap: 16,
  },
  backButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  backButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#C7D2FE',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
