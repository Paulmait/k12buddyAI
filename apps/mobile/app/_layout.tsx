import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Consent version must match consent.tsx
const CONSENT_VERSION = '1.0';
const CONSENT_STORAGE_KEY = 'k12buddy_ai_consent';

// Check if user has valid consent
async function checkConsent(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return false;

    const consent = JSON.parse(stored);
    return consent.version === CONSENT_VERSION;
  } catch {
    return false;
  }
}

// Minimal loading screen
function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🎓</Text>
      <Text style={styles.title}>K-12 Buddy</Text>
      <ActivityIndicator size="large" color="#fff" style={styles.spinner} />
      <Text style={styles.subtitle}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  subtitle: {
    fontSize: 16,
    color: '#C7D2FE',
    marginTop: 16,
  },
  spinner: {
    marginTop: 16,
  },
});

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasConsent, setHasConsent] = useState(false);
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  // Check consent on mount
  useEffect(() => {
    async function initApp() {
      try {
        const consentValid = await checkConsent();
        setHasConsent(consentValid);
      } catch (error) {
        console.error('Init error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    initApp();
  }, []);

  // Handle navigation based on consent
  useEffect(() => {
    if (isLoading) return;
    if (!navigationState?.key) return; // Navigation not ready

    const inConsentScreen = segments[0] === 'consent';

    // Re-check consent when navigating away from consent screen
    // This catches when user just gave consent
    async function verifyAndNavigate() {
      const currentConsent = await checkConsent();

      if (!currentConsent && !inConsentScreen) {
        // No consent, redirect to consent screen
        router.replace('/consent');
      } else if (currentConsent && inConsentScreen) {
        // Has consent but on consent screen, go to auth
        setHasConsent(true);
        router.replace('/auth');
      } else if (currentConsent && !hasConsent) {
        // Update state if consent was just given
        setHasConsent(true);
      }
    }

    verifyAndNavigate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, segments, navigationState?.key]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <StatusBar style="light" />
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
        initialRouteName={hasConsent ? 'auth' : 'consent'}
      >
        {/* Consent gate - shown first if no consent */}
        <Stack.Screen name="consent" options={{ headerShown: false }} />

        {/* Auth flow */}
        <Stack.Screen name="auth" options={{ headerShown: false }} />

        {/* Main app */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Onboarding */}
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />

        {/* Parent flows */}
        <Stack.Screen name="parent-consent" options={{ headerShown: false }} />
        <Stack.Screen name="parent-dashboard" options={{ headerShown: false }} />

        {/* Settings screens */}
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
        <Stack.Screen
          name="settings/subscription"
          options={{
            title: 'Subscription',
            headerShown: false,
          }}
        />

        {/* Profile edit */}
        <Stack.Screen
          name="profile/edit"
          options={{
            title: 'Edit Profile',
            headerShown: false,
          }}
        />

        {/* Admin */}
        <Stack.Screen
          name="admin/index"
          options={{
            title: 'Admin Dashboard',
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}
