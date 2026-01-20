import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

type Grade = 'K' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';

const GRADES: { value: Grade; label: string }[] = [
  { value: 'K', label: 'Kindergarten' },
  { value: '1', label: '1st Grade' },
  { value: '2', label: '2nd Grade' },
  { value: '3', label: '3rd Grade' },
  { value: '4', label: '4th Grade' },
  { value: '5', label: '5th Grade' },
  { value: '6', label: '6th Grade' },
  { value: '7', label: '7th Grade' },
  { value: '8', label: '8th Grade' },
  { value: '9', label: '9th Grade' },
  { value: '10', label: '10th Grade' },
  { value: '11', label: '11th Grade' },
  { value: '12', label: '12th Grade' },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);

  const handleNext = () => {
    if (step === 0) {
      setStep(1);
    } else {
      // Complete onboarding
      router.replace('/(tabs)');
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const canProceed = step === 0 || selectedGrade !== null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressDot, step >= 0 && styles.progressDotActive]} />
        <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {step === 0 ? (
          <View style={styles.stepContainer}>
            <Text style={styles.welcomeIcon}>🎓</Text>
            <Text style={styles.welcomeTitle}>Welcome to K12Buddy!</Text>
            <Text style={styles.welcomeSubtitle}>
              Your personal AI study companion. Let&apos;s set things up so I can help you learn better.
            </Text>
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>💡</Text>
                <Text style={styles.featureText}>Get help with homework</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>📸</Text>
                <Text style={styles.featureText}>Scan and solve problems</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>🏆</Text>
                <Text style={styles.featureText}>Earn badges and rewards</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What grade are you in?</Text>
            <Text style={styles.stepSubtitle}>
              This helps me give you the right level of help
            </Text>
            <ScrollView
              style={styles.gradeList}
              contentContainerStyle={styles.gradeListContent}
              showsVerticalScrollIndicator={false}
            >
              {GRADES.map(grade => (
                <TouchableOpacity
                  key={grade.value}
                  style={[
                    styles.gradeItem,
                    selectedGrade === grade.value && styles.gradeItemSelected,
                  ]}
                  onPress={() => setSelectedGrade(grade.value)}
                >
                  <Text
                    style={[
                      styles.gradeItemText,
                      selectedGrade === grade.value && styles.gradeItemTextSelected,
                    ]}
                  >
                    {grade.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

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
            !canProceed && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!canProceed}
        >
          <Text style={styles.nextButtonText}>
            {step === 1 ? "Let's Go!" : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  gradeList: {
    flex: 1,
  },
  gradeListContent: {
    gap: 8,
    paddingBottom: 16,
  },
  gradeItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  gradeItemSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  gradeItemText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  gradeItemTextSelected: {
    color: '#4F46E5',
    fontWeight: '600',
  },
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
