import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { supabase } from '../src/lib/supabase';
import { registerDevice } from '../src/lib/deviceRegistration';
import { isUnder13 } from '../src/lib/securityUtils';
import type { Grade } from '@k12buddy/shared';

const GRADES: Grade[] = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

type AccountType = 'student' | 'parent';

export default function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('student');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [grade, setGrade] = useState<Grade>('5');
  const [state, setState] = useState('CA');
  const [loading, setLoading] = useState(false);

  // Generate years for birth year selection (5-18 years old)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 14 }, (_, i) => (currentYear - 5 - i).toString());
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

  const getBirthDate = (): string | null => {
    if (!birthMonth || !birthYear) return null;
    return `${birthYear}-${birthMonth}-01`;
  };

  const checkAge = (): { isValid: boolean; isUnder13: boolean } => {
    if (accountType !== 'student' || !birthMonth || !birthYear) {
      return { isValid: true, isUnder13: false };
    }

    const birthDate = new Date(parseInt(birthYear), parseInt(birthMonth) - 1, 1);
    const under13 = isUnder13(birthDate);

    return { isValid: true, isUnder13: under13 };
  };

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else if (data.user) {
      // Register device on sign in
      await registerDevice(data.user.id);
    }

    setLoading(false);
  }

  async function handleSignUp() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    if (accountType === 'student' && (!birthMonth || !birthYear)) {
      Alert.alert('Error', 'Please enter your birth month and year');
      return;
    }

    setLoading(true);

    // Check age for COPPA
    const { isUnder13: isChildUnder13 } = checkAge();

    // Sign up
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      Alert.alert('Error', signUpError.message);
      setLoading(false);
      return;
    }

    // Create profiles and student records
    if (data.user) {
      try {
        // Create profile
        const birthDate = getBirthDate();
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          account_type: accountType,
          birth_date: accountType === 'student' ? birthDate : null,
          parent_consent_verified: accountType === 'parent' ? true : !isChildUnder13,
          onboarding_completed: false,
        });

        if (profileError) {
          console.error('Error creating profile:', profileError);
        }

        // Create student profile only for students
        if (accountType === 'student') {
          const { error: studentError } = await supabase.from('students').insert({
            user_id: data.user.id,
            grade,
            state,
          });

          if (studentError) {
            console.error('Error creating student profile:', studentError);
            Alert.alert('Error', 'Account created but failed to set up student profile.');
          }
        }

        // Register device
        await registerDevice(data.user.id);

        // Show COPPA notice if under 13
        if (isChildUnder13) {
          Alert.alert(
            'Parent Consent Required',
            'Since you are under 13, a parent or guardian will need to provide consent before you can use K12Buddy. You will be directed to the parent consent flow after onboarding.',
            [{ text: 'OK' }]
          );
        }
      } catch (err) {
        console.error('Error during signup setup:', err);
      }
    }

    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.logo}>🎓</Text>
          <Text style={styles.title}>K-12 Buddy</Text>
          <Text style={styles.subtitle}>Your AI Learning Companion</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your.email@example.com"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
          />

          {mode === 'signup' && (
            <>
              {/* Account Type Selection */}
              <Text style={styles.label}>I am a...</Text>
              <View style={styles.accountTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.accountTypeButton,
                    accountType === 'student' && styles.accountTypeButtonActive,
                  ]}
                  onPress={() => setAccountType('student')}
                >
                  <Text style={styles.accountTypeIcon}>🎒</Text>
                  <Text
                    style={[
                      styles.accountTypeText,
                      accountType === 'student' && styles.accountTypeTextActive,
                    ]}
                  >
                    Student
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.accountTypeButton,
                    accountType === 'parent' && styles.accountTypeButtonActive,
                  ]}
                  onPress={() => setAccountType('parent')}
                >
                  <Text style={styles.accountTypeIcon}>👨‍👩‍👧</Text>
                  <Text
                    style={[
                      styles.accountTypeText,
                      accountType === 'parent' && styles.accountTypeTextActive,
                    ]}
                  >
                    Parent
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Student-specific fields */}
              {accountType === 'student' && (
                <>
                  {/* Birth Month/Year for COPPA */}
                  <Text style={styles.label}>When were you born?</Text>
                  <Text style={styles.helperText}>We use this to personalize your experience</Text>
                  <View style={styles.birthDateRow}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.monthScroll}
                    >
                      {months.map(m => (
                        <TouchableOpacity
                          key={m}
                          style={[
                            styles.monthButton,
                            birthMonth === m && styles.monthButtonActive,
                          ]}
                          onPress={() => setBirthMonth(m)}
                        >
                          <Text
                            style={[
                              styles.monthButtonText,
                              birthMonth === m && styles.monthButtonTextActive,
                            ]}
                          >
                            {new Date(2000, parseInt(m) - 1).toLocaleString('default', { month: 'short' })}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.yearScroll}
                  >
                    {years.map(y => (
                      <TouchableOpacity
                        key={y}
                        style={[
                          styles.yearButton,
                          birthYear === y && styles.yearButtonActive,
                        ]}
                        onPress={() => setBirthYear(y)}
                      >
                        <Text
                          style={[
                            styles.yearButtonText,
                            birthYear === y && styles.yearButtonTextActive,
                          ]}
                        >
                          {y}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.label}>Grade Level</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.gradeScroll}
                  >
                    {GRADES.map(g => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.gradeButton,
                          grade === g && styles.gradeButtonActive,
                        ]}
                        onPress={() => setGrade(g)}
                      >
                        <Text
                          style={[
                            styles.gradeButtonText,
                            grade === g && styles.gradeButtonTextActive,
                          ]}
                        >
                          {g === 'K' ? 'K' : g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.label}>State</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.stateScroll}
                  >
                    {STATES.map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.stateButton,
                          state === s && styles.stateButtonActive,
                        ]}
                        onPress={() => setState(s)}
                      >
                        <Text
                          style={[
                            styles.stateButtonText,
                            state === s && styles.stateButtonTextActive,
                          ]}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Parent-specific message */}
              {accountType === 'parent' && (
                <View style={styles.parentInfo}>
                  <Text style={styles.parentInfoIcon}>👨‍👩‍👧‍👦</Text>
                  <Text style={styles.parentInfoTitle}>Parent Account</Text>
                  <Text style={styles.parentInfoText}>
                    As a parent, you'll be able to monitor your child's learning progress and manage their account settings.
                  </Text>
                </View>
              )}
            </>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={mode === 'signin' ? handleSignIn : handleSignUp}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            <Text style={styles.switchText}>
              {mode === 'signin'
                ? "Don't have an account? Sign Up"
                : 'Already have an account? Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4F46E5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#C7D2FE',
  },
  form: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    marginTop: -4,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#1F2937',
  },
  accountTypeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  accountTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accountTypeButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  accountTypeIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  accountTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  accountTypeTextActive: {
    color: '#4F46E5',
  },
  birthDateRow: {
    marginBottom: 8,
  },
  monthScroll: {
    marginBottom: 8,
  },
  monthButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  monthButtonActive: {
    backgroundColor: '#4F46E5',
  },
  monthButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  monthButtonTextActive: {
    color: '#fff',
  },
  yearScroll: {
    marginBottom: 16,
  },
  yearButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  yearButtonActive: {
    backgroundColor: '#4F46E5',
  },
  yearButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  yearButtonTextActive: {
    color: '#fff',
  },
  gradeScroll: {
    marginBottom: 16,
  },
  gradeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  gradeButtonActive: {
    backgroundColor: '#4F46E5',
  },
  gradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  gradeButtonTextActive: {
    color: '#fff',
  },
  stateScroll: {
    marginBottom: 24,
  },
  stateButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  stateButtonActive: {
    backgroundColor: '#4F46E5',
  },
  stateButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  stateButtonTextActive: {
    color: '#fff',
  },
  parentInfo: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  parentInfoIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  parentInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 8,
  },
  parentInfoText: {
    fontSize: 14,
    color: '#15803D',
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#C7D2FE',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchText: {
    color: '#4F46E5',
    fontSize: 14,
  },
});
