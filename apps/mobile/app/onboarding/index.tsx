import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../src/lib/supabase';
import { shouldAskForLocationConsent, updateUserLocation, getTimezone } from '../../src/lib/locationService';
import { markProfileCompleted, getUserProfile, isUserUnder13 } from '../../src/lib/accountService';
import { useResponsive } from '../../src/hooks/useResponsive';
import type { Grade, Subject } from '../../src/types';

const { width } = Dimensions.get('window');

type LearningStyle = 'visual' | 'auditory' | 'reading' | 'kinesthetic';

interface OnboardingState {
  grade: Grade | null;
  subjects: Subject[];
  learningStyle: LearningStyle | null;
  locationConsent: boolean | null;
}

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

const SUBJECTS: { value: Subject; label: string; icon: string }[] = [
  { value: 'math', label: 'Math', icon: '🔢' },
  { value: 'english', label: 'English', icon: '📚' },
  { value: 'science', label: 'Science', icon: '🔬' },
  { value: 'social_studies', label: 'Social Studies', icon: '🌍' },
  { value: 'reading', label: 'Reading', icon: '📖' },
  { value: 'writing', label: 'Writing', icon: '✏️' },
];

const LEARNING_STYLES: { value: LearningStyle; label: string; icon: string; description: string }[] = [
  {
    value: 'visual',
    label: 'Visual',
    icon: '👁️',
    description: 'I learn best with pictures, diagrams, and videos',
  },
  {
    value: 'auditory',
    label: 'Auditory',
    icon: '👂',
    description: 'I learn best by listening and discussing',
  },
  {
    value: 'reading',
    label: 'Reading/Writing',
    icon: '📝',
    description: 'I learn best by reading and taking notes',
  },
  {
    value: 'kinesthetic',
    label: 'Hands-On',
    icon: '🤲',
    description: 'I learn best by doing and practicing',
  },
];

const ONBOARDING_COMPLETE_KEY = 'k12buddy_onboarding_complete';

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<OnboardingState>({
    grade: null,
    subjects: [],
    learningStyle: null,
    locationConsent: null,
  });
  const [saving, setSaving] = useState(false);
  const [showLocationStep, setShowLocationStep] = useState(false);
  const [isUnder13, setIsUnder13] = useState<boolean | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const { isPhone, isTablet, getColumns, getGridItemWidth } = useResponsive();

  // Check if we need location step and user's age
  useEffect(() => {
    async function checkLocationAndAge() {
      const shouldAsk = await shouldAskForLocationConsent();
      setShowLocationStep(shouldAsk);

      const under13Result = await isUserUnder13();
      setIsUnder13(under13Result);

      const profile = await getUserProfile();
      setAccountType(profile?.account_type || 'student');
    }
    checkLocationAndAge();
  }, []);

  // Total steps: Welcome, Grade, Subjects, Learning Style, [Location optional], Complete
  const totalSteps = showLocationStep ? 5 : 4;

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

  const handleGradeSelect = (grade: Grade) => {
    setState(prev => ({ ...prev, grade }));
  };

  const handleSubjectToggle = (subject: Subject) => {
    setState(prev => {
      const subjects = prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject];
      return { ...prev, subjects };
    });
  };

  const handleLearningStyleSelect = (style: LearningStyle) => {
    setState(prev => ({ ...prev, learningStyle: style }));
  };

  const handleLocationConsent = async (consent: boolean) => {
    setState(prev => ({ ...prev, locationConsent: consent }));

    if (consent) {
      await updateUserLocation();
    }
  };

  const handleComplete = async () => {
    if (saving) return;
    setSaving(true);

    try {
      // Save preferences to Supabase
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from('profiles')
          .update({
            grade: state.grade,
            preferred_subjects: state.subjects,
            learning_style: state.learningStyle,
            onboarding_completed: true,
            profile_completed: true,
            location_consent: state.locationConsent ?? false,
          })
          .eq('id', user.id);
      }

      // Mark onboarding as complete
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      await markProfileCompleted();

      // Check if parent consent is needed
      if (isUnder13 === true) {
        router.replace('/parent-consent');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Error saving onboarding preferences:', error);
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: // Welcome
        return true;
      case 1: // Grade
        return state.grade !== null;
      case 2: // Subjects
        return state.subjects.length > 0;
      case 3: // Learning style
        return state.learningStyle !== null;
      case 4: // Location (if shown)
        return showLocationStep ? state.locationConsent !== null : true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    const lastStep = showLocationStep ? 4 : 3;
    if (step < lastStep) {
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

  const renderStep = () => {
    switch (step) {
      case 0:
        return <WelcomeStep />;
      case 1:
        return (
          <GradeStep
            selectedGrade={state.grade}
            onSelect={handleGradeSelect}
          />
        );
      case 2:
        return (
          <SubjectsStep
            selectedSubjects={state.subjects}
            onToggle={handleSubjectToggle}
            columns={getColumns(2, 3, 3)}
            itemWidth={getGridItemWidth(getColumns(2, 3, 3), 12, 24)}
          />
        );
      case 3:
        return (
          <LearningStyleStep
            selectedStyle={state.learningStyle}
            onSelect={handleLearningStyleSelect}
          />
        );
      case 4:
        if (showLocationStep) {
          return (
            <LocationStep
              consent={state.locationConsent}
              onSelect={handleLocationConsent}
            />
          );
        }
        return null;
      default:
        return null;
    }
  };

  const getProgressDots = () => {
    const dots = [];
    for (let i = 0; i <= (showLocationStep ? 4 : 3); i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.progressDot,
            i <= step && styles.progressDotActive,
          ]}
        />
      );
    }
    return dots;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        {getProgressDots()}
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
            {step === (showLocationStep ? 4 : 3) ? (saving ? 'Saving...' : "Let's Go!") : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function WelcomeStep() {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.welcomeIcon}>🎓</Text>
      <Text style={styles.welcomeTitle}>Welcome to K12Buddy!</Text>
      <Text style={styles.welcomeSubtitle}>
        Your personal AI study companion. Let's set things up so I can help you
        learn better.
      </Text>
      <View style={styles.featureList}>
        <FeatureItem icon="💡" text="Get help with homework" />
        <FeatureItem icon="📸" text="Scan and solve problems" />
        <FeatureItem icon="🏆" text="Earn badges and rewards" />
        <FeatureItem icon="📈" text="Track your progress" />
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

function GradeStep({
  selectedGrade,
  onSelect,
}: {
  selectedGrade: Grade | null;
  onSelect: (grade: Grade) => void;
}) {
  return (
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
            onPress={() => onSelect(grade.value)}
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
  );
}

function SubjectsStep({
  selectedSubjects,
  onToggle,
  columns,
  itemWidth,
}: {
  selectedSubjects: Subject[];
  onToggle: (subject: Subject) => void;
  columns: number;
  itemWidth: number;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What subjects do you need help with?</Text>
      <Text style={styles.stepSubtitle}>
        Select all that apply - you can change this later
      </Text>
      <View style={styles.subjectsGrid}>
        {SUBJECTS.map(subject => {
          const isSelected = selectedSubjects.includes(subject.value);
          return (
            <TouchableOpacity
              key={subject.value}
              style={[
                styles.subjectCard,
                { width: itemWidth },
                isSelected && styles.subjectCardSelected,
              ]}
              onPress={() => onToggle(subject.value)}
            >
              <Text style={styles.subjectIcon}>{subject.icon}</Text>
              <Text
                style={[
                  styles.subjectLabel,
                  isSelected && styles.subjectLabelSelected,
                ]}
              >
                {subject.label}
              </Text>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function LearningStyleStep({
  selectedStyle,
  onSelect,
}: {
  selectedStyle: LearningStyle | null;
  onSelect: (style: LearningStyle) => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>How do you learn best?</Text>
      <Text style={styles.stepSubtitle}>
        I'll adapt my teaching style to match yours
      </Text>
      <View style={styles.stylesContainer}>
        {LEARNING_STYLES.map(style => (
          <TouchableOpacity
            key={style.value}
            style={[
              styles.styleCard,
              selectedStyle === style.value && styles.styleCardSelected,
            ]}
            onPress={() => onSelect(style.value)}
          >
            <Text style={styles.styleIcon}>{style.icon}</Text>
            <View style={styles.styleTextContainer}>
              <Text
                style={[
                  styles.styleLabel,
                  selectedStyle === style.value && styles.styleLabelSelected,
                ]}
              >
                {style.label}
              </Text>
              <Text style={styles.styleDescription}>{style.description}</Text>
            </View>
            {selectedStyle === style.value && (
              <Text style={styles.styleCheckmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function LocationStep({
  consent,
  onSelect,
}: {
  consent: boolean | null;
  onSelect: (consent: boolean) => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.locationIcon}>📍</Text>
      <Text style={styles.stepTitle}>Enable Location?</Text>
      <Text style={styles.stepSubtitle}>
        We use your approximate location (city-level only) to personalize your learning experience with local content and events.
      </Text>

      <View style={styles.privacyNote}>
        <Text style={styles.privacyNoteIcon}>🔒</Text>
        <Text style={styles.privacyNoteText}>
          We never track your precise location or share location data with third parties.
        </Text>
      </View>

      <View style={styles.locationOptions}>
        <TouchableOpacity
          style={[
            styles.locationOption,
            consent === true && styles.locationOptionSelected,
          ]}
          onPress={() => onSelect(true)}
        >
          <Text style={styles.locationOptionIcon}>✅</Text>
          <Text
            style={[
              styles.locationOptionText,
              consent === true && styles.locationOptionTextSelected,
            ]}
          >
            Enable Location
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.locationOption,
            consent === false && styles.locationOptionSelected,
          ]}
          onPress={() => onSelect(false)}
        >
          <Text style={styles.locationOptionIcon}>❌</Text>
          <Text
            style={[
              styles.locationOptionText,
              consent === false && styles.locationOptionTextSelected,
            ]}
          >
            No Thanks
          </Text>
        </TouchableOpacity>
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
  // Grade step
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
  // Subjects step
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  subjectCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    position: 'relative',
  },
  subjectCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  subjectIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  subjectLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  subjectLabelSelected: {
    color: '#4F46E5',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 16,
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  // Learning style step
  stylesContainer: {
    gap: 12,
  },
  styleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  styleCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  styleIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  styleTextContainer: {
    flex: 1,
  },
  styleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  styleLabelSelected: {
    color: '#4F46E5',
  },
  styleDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  styleCheckmark: {
    fontSize: 20,
    color: '#4F46E5',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Location step
  locationIcon: {
    fontSize: 64,
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  privacyNoteIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
  locationOptions: {
    gap: 12,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  locationOptionSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  locationOptionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  locationOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  locationOptionTextSelected: {
    color: '#4F46E5',
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
