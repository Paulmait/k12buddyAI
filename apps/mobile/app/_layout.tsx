import { useEffect, useState, useRef } from 'react';
import { View, AppState, AppStateStatus, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../src/lib/supabase';
import { GamificationProvider } from '../src/contexts/GamificationContext';
import { OfflineProvider } from '../src/contexts/OfflineContext';
import { AccessibilityProvider } from '../src/contexts/AccessibilityContext';
import { LevelUpModal } from '../src/components/LevelUpModal';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { useGamification } from '../src/contexts/GamificationContext';
import { registerDevice, updateDeviceActivity } from '../src/lib/deviceRegistration';
import type { Session } from '@supabase/supabase-js';

// Loading screen component
function LoadingScreen() {
  return (
    <View style={loadingStyles.container}>
      <Text style={loadingStyles.logo}>🎓</Text>
      <Text style={loadingStyles.title}>K-12 Buddy</Text>
      <ActivityIndicator size="large" color="#fff" style={loadingStyles.spinner} />
    </View>
  );
}

// Error screen component
function ErrorScreen({ message }: { message: string }) {
  return (
    <View style={loadingStyles.errorContainer}>
      <Text style={loadingStyles.errorIcon}>😵</Text>
      <Text style={loadingStyles.errorTitle}>Oops!</Text>
      <Text style={loadingStyles.errorMessage}>{message}</Text>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  spinner: {
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#7F1D1D',
    textAlign: 'center',
    lineHeight: 24,
  },
});

const ONBOARDING_COMPLETE_KEY = 'k12buddy_onboarding_complete';

// Component to handle level up modal globally
function LevelUpHandler() {
  const { levelUpEvent, dismissLevelUp } = useGamification();

  if (!levelUpEvent) return null;

  return (
    <LevelUpModal
      visible={true}
      level={levelUpEvent.newLevel}
      title={levelUpEvent.title}
      icon={levelUpEvent.icon}
      xpBonus={levelUpEvent.xpBonus}
      onClose={dismissLevelUp}
    />
  );
}

// Wrapper for authenticated content with gamification and offline support
function AuthenticatedContent({ needsOnboarding }: { needsOnboarding: boolean }) {
  const appState = useRef(AppState.currentState);

  // Handle app state changes to update device activity
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        updateDeviceActivity();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <ErrorBoundary level="critical">
      <AccessibilityProvider>
        <OfflineProvider>
          <GamificationProvider>
          <View style={{ flex: 1 }}>
            <OfflineBanner />
            <ErrorBoundary level="screen">
              <Stack
                screenOptions={{
                  headerStyle: {
                    backgroundColor: '#4F46E5',
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                }}
                initialRouteName={needsOnboarding ? 'onboarding' : '(tabs)'}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="onboarding"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="chat/[sessionId]"
                  options={{ title: 'Chat' }}
                />
                <Stack.Screen
                  name="parent-consent"
                  options={{ title: 'Parent Consent', headerShown: false }}
                />
                <Stack.Screen
                  name="parent-dashboard"
                  options={{ title: 'Parent Dashboard', headerShown: false }}
                />
                {/* Profile routes */}
                <Stack.Screen
                  name="profile/edit"
                  options={{
                    title: 'Edit Profile',
                    headerShown: false,
                    presentation: 'modal',
                  }}
                />
                {/* Settings routes */}
                <Stack.Screen
                  name="settings/account"
                  options={{
                    title: 'Account Settings',
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="settings/devices"
                  options={{
                    title: 'My Devices',
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="settings/privacy"
                  options={{
                    title: 'Privacy Settings',
                    headerShown: false,
                  }}
                />
              </Stack>
            </ErrorBoundary>
            <LevelUpHandler />
          </View>
          </GamificationProvider>
        </OfflineProvider>
      </AccessibilityProvider>
    </ErrorBoundary>
  );
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(true);

  useEffect(() => {
    // Check onboarding status and get session
    async function initialize() {
      try {
        // Check if onboarding is complete
        const onboardingStatus = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        setOnboardingComplete(onboardingStatus === 'true');

        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          // Don't set error for session issues - just show auth screen
        }

        setSession(session);

        // Register device if session exists (don't fail on this)
        if (session?.user) {
          try {
            await registerDevice(session.user.id);
          } catch (deviceError) {
            console.error('Device registration error:', deviceError);
            // Non-critical, continue
          }
        }
      } catch (err) {
        console.error('Error during initialization:', err);
        setError('Failed to initialize app. Please restart.');
      } finally {
        setLoading(false);
      }
    }

    initialize();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);

        // Register device on new session
        if (session?.user && _event === 'SIGNED_IN') {
          try {
            await registerDevice(session.user.id);
          } catch (deviceError) {
            console.error('Device registration error:', deviceError);
          }
        }

        // Reset onboarding check for new logins
        if (session && !session.user) {
          setOnboardingComplete(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen message={error} />;
  }

  return (
    <>
      <StatusBar style="auto" />
      {session ? (
        <AuthenticatedContent needsOnboarding={!onboardingComplete} />
      ) : (
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#4F46E5',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen name="auth" options={{ headerShown: false }} />
        </Stack>
      )}
    </>
  );
}
