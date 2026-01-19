import { supabase } from './supabase';
import * as Application from 'expo-application';
import { v4 as uuidv4 } from 'uuid';

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_SUPABASE_URL + '/functions/v1';

// Generate a session ID for the current app session
let currentSessionId: string = '';

function getSessionId(): string {
  if (!currentSessionId) {
    currentSessionId = uuidv4();
  }
  return currentSessionId;
}

// Get app version
function getAppVersion(): string {
  return Application.nativeApplicationVersion || '0.1.0';
}

// Analytics opt-out flag (stored in AsyncStorage in real implementation)
let analyticsOptedOut = false;

export function setAnalyticsOptOut(optOut: boolean) {
  analyticsOptedOut = optOut;
}

export function isAnalyticsOptedOut(): boolean {
  return analyticsOptedOut;
}

// Track an event
export async function trackEvent(
  studentId: string,
  eventName: string,
  properties?: Record<string, unknown>
): Promise<void> {
  // Respect opt-out preference
  if (analyticsOptedOut) {
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Strip any potential PII from properties before sending
    const safeProperties = stripPII(properties || {});

    await fetch(`${FUNCTIONS_URL}/analytics/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        student_id: studentId,
        event_name: eventName,
        event_properties: safeProperties,
        session_id: getSessionId(),
        app_version: getAppVersion(),
      }),
    });
  } catch (error) {
    // Silently fail - analytics should never break the app
    console.debug('Analytics track error:', error);
  }
}

// Strip potential PII from properties
function stripPII(props: Record<string, unknown>): Record<string, unknown> {
  const piiFields = new Set([
    'email', 'name', 'phone', 'address', 'ssn', 'password',
    'token', 'content', 'message', 'question', 'answer',
  ]);

  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    const lowerKey = key.toLowerCase();

    // Skip PII fields
    if (piiFields.has(lowerKey)) continue;

    // Skip fields that might contain PII
    if (lowerKey.includes('email') || lowerKey.includes('name') ||
        lowerKey.includes('phone') || lowerKey.includes('address')) {
      continue;
    }

    // Recursively handle nested objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      safe[key] = stripPII(value as Record<string, unknown>);
    } else {
      safe[key] = value;
    }
  }

  return safe;
}

// Convenience methods for common events
export const Analytics = {
  // Track app open
  appOpened: (studentId: string) =>
    trackEvent(studentId, 'app_opened'),

  // Track app background
  appBackgrounded: (studentId: string) =>
    trackEvent(studentId, 'app_backgrounded'),

  // Track question asked (no content, just metadata)
  questionAsked: (studentId: string, subject: string, grade: string, mode: string) =>
    trackEvent(studentId, 'question_asked', { subject, grade, mode }),

  // Track scan completed
  scanCompleted: (studentId: string, success: boolean) =>
    trackEvent(studentId, 'scan_completed', { success }),

  // Track badge earned
  badgeEarned: (studentId: string, badgeCode: string) =>
    trackEvent(studentId, 'badge_earned', { badge_code: badgeCode }),

  // Track streak updated
  streakUpdated: (studentId: string, streakCount: number) =>
    trackEvent(studentId, 'streak_updated', { streak_count: streakCount }),

  // Track level up
  levelUp: (studentId: string, newLevel: number) =>
    trackEvent(studentId, 'level_up', { new_level: newLevel }),

  // Track challenge started
  challengeStarted: (studentId: string, challengeId: string) =>
    trackEvent(studentId, 'challenge_started', { challenge_id: challengeId }),

  // Track challenge completed
  challengeCompleted: (studentId: string, challengeId: string) =>
    trackEvent(studentId, 'challenge_completed', { challenge_id: challengeId }),

  // Track textbook selected
  textbookSelected: (studentId: string, textbookId: string, subject: string) =>
    trackEvent(studentId, 'textbook_selected', { textbook_id: textbookId, subject }),

  // Track session started
  sessionStarted: (studentId: string, sessionType: string) =>
    trackEvent(studentId, 'session_started', { session_type: sessionType }),

  // Track session ended
  sessionEnded: (studentId: string, duration: number) =>
    trackEvent(studentId, 'session_ended', { duration_seconds: duration }),

  // Track error (no sensitive data)
  errorOccurred: (studentId: string, errorType: string, screen: string) =>
    trackEvent(studentId, 'error_occurred', { error_type: errorType, screen }),
};

export default Analytics;
