import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { getUserProfile, updateUserProfile } from '../../src/lib/accountService';
import { useResponsive } from '../../src/hooks/useResponsive';
import type { Grade, Subject } from '../../src/types';

type LearningStyle = 'visual' | 'auditory' | 'reading' | 'kinesthetic';

const GRADES: { value: Grade; label: string }[] = [
  { value: 'K', label: 'K' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '8', label: '8' },
  { value: '9', label: '9' },
  { value: '10', label: '10' },
  { value: '11', label: '11' },
  { value: '12', label: '12' },
];

const SUBJECTS: { value: Subject; label: string; icon: string }[] = [
  { value: 'math', label: 'Math', icon: '🔢' },
  { value: 'english', label: 'English', icon: '📚' },
  { value: 'science', label: 'Science', icon: '🔬' },
  { value: 'social_studies', label: 'Social Studies', icon: '🌍' },
  { value: 'reading', label: 'Reading', icon: '📖' },
  { value: 'writing', label: 'Writing', icon: '✏️' },
];

const LEARNING_STYLES: { value: LearningStyle; label: string; icon: string }[] = [
  { value: 'visual', label: 'Visual', icon: '👁️' },
  { value: 'auditory', label: 'Auditory', icon: '👂' },
  { value: 'reading', label: 'Reading/Writing', icon: '📝' },
  { value: 'kinesthetic', label: 'Hands-On', icon: '🤲' },
];

const AVATARS = ['🎓', '🦊', '🐱', '🐶', '🦁', '🐼', '🐨', '🐸', '🦄', '🐝', '🦋', '🌟'];

interface ProfileData {
  displayName: string;
  grade: Grade | null;
  preferredSubjects: Subject[];
  learningStyle: LearningStyle | null;
  avatarUrl: string;
}

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    displayName: '',
    grade: null,
    preferredSubjects: [],
    learningStyle: null,
    avatarUrl: '🎓',
  });

  const { getGridItemWidth, getColumns } = useResponsive();

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const userProfile = await getUserProfile();
      if (userProfile) {
        setProfile({
          displayName: userProfile.display_name || '',
          grade: (userProfile.grade as Grade) || null,
          preferredSubjects: (userProfile.preferred_subjects as Subject[]) || [],
          learningStyle: (userProfile.learning_style as LearningStyle) || null,
          avatarUrl: userProfile.avatar_url || '🎓',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);

    try {
      const result = await updateUserProfile({
        display_name: profile.displayName,
        grade: profile.grade,
        preferred_subjects: profile.preferredSubjects,
        learning_style: profile.learningStyle,
        avatar_url: profile.avatarUrl,
      });

      if (result.success) {
        Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  const toggleSubject = (subject: Subject) => {
    setProfile(prev => ({
      ...prev,
      preferredSubjects: prev.preferredSubjects.includes(subject)
        ? prev.preferredSubjects.filter(s => s !== subject)
        : [...prev.preferredSubjects, subject],
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
            <Text style={[styles.saveButtonText, saving && styles.saveButtonTextDisabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Avatar Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Avatar</Text>
          <View style={styles.avatarGrid}>
            {AVATARS.map(avatar => (
              <TouchableOpacity
                key={avatar}
                style={[
                  styles.avatarOption,
                  profile.avatarUrl === avatar && styles.avatarOptionSelected,
                ]}
                onPress={() => setProfile(prev => ({ ...prev, avatarUrl: avatar }))}
              >
                <Text style={styles.avatarEmoji}>{avatar}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Display Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={profile.displayName}
            onChangeText={(text) => setProfile(prev => ({ ...prev, displayName: text }))}
            placeholder="Enter your display name"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Grade Level */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grade Level</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.gradeRow}>
              {GRADES.map(grade => (
                <TouchableOpacity
                  key={grade.value}
                  style={[
                    styles.gradeButton,
                    profile.grade === grade.value && styles.gradeButtonSelected,
                  ]}
                  onPress={() => setProfile(prev => ({ ...prev, grade: grade.value }))}
                >
                  <Text
                    style={[
                      styles.gradeButtonText,
                      profile.grade === grade.value && styles.gradeButtonTextSelected,
                    ]}
                  >
                    {grade.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Preferred Subjects */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Subjects</Text>
          <View style={styles.subjectsGrid}>
            {SUBJECTS.map(subject => {
              const isSelected = profile.preferredSubjects.includes(subject.value);
              return (
                <TouchableOpacity
                  key={subject.value}
                  style={[
                    styles.subjectCard,
                    isSelected && styles.subjectCardSelected,
                  ]}
                  onPress={() => toggleSubject(subject.value)}
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

        {/* Learning Style */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Learning Style</Text>
          <View style={styles.stylesGrid}>
            {LEARNING_STYLES.map(style => (
              <TouchableOpacity
                key={style.value}
                style={[
                  styles.styleCard,
                  profile.learningStyle === style.value && styles.styleCardSelected,
                ]}
                onPress={() => setProfile(prev => ({ ...prev, learningStyle: style.value }))}
              >
                <Text style={styles.styleIcon}>{style.icon}</Text>
                <Text
                  style={[
                    styles.styleLabel,
                    profile.learningStyle === style.value && styles.styleLabelSelected,
                  ]}
                >
                  {style.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
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
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6B7280',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
  saveButtonTextDisabled: {
    color: '#C7D2FE',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  avatarOption: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  gradeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gradeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeButtonSelected: {
    backgroundColor: '#4F46E5',
  },
  gradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  gradeButtonTextSelected: {
    color: '#fff',
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  subjectCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  subjectCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  subjectIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  subjectLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  subjectLabelSelected: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  stylesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  styleCard: {
    width: '48%',
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
    fontSize: 28,
    marginBottom: 8,
  },
  styleLabel: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  styleLabelSelected: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  bottomPadding: {
    height: 32,
  },
});
