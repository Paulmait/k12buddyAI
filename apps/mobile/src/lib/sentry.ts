/**
 * Sentry Error Monitoring Configuration
 * Provides crash reporting and error tracking for production
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

// Sentry DSN - should be in environment variable in production
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

// Environment detection
const getEnvironment = (): string => {
  if (__DEV__) return 'development';
  if (Constants.appOwnership === 'expo') return 'expo-go';
  return 'production';
};

/**
 * Initialize Sentry for error tracking
 */
export function initializeSentry(): void {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: getEnvironment(),
    release: Application.nativeApplicationVersion || '0.0.0',
    dist: Application.nativeBuildVersion || '1',

    // Performance monitoring
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,

    // Enable native crash handling
    enableNative: true,
    enableNativeCrashHandling: true,

    // Session replay (if needed for debugging)
    // replaysSessionSampleRate: 0.1,
    // replaysOnErrorSampleRate: 1.0,

    // Don't send events in development
    enabled: !__DEV__,

    // Attach stack traces to all messages
    attachStacktrace: true,

    // Filter sensitive data
    beforeSend(event) {
      // Remove PII from error reports
      if (event.user) {
        // Only keep non-identifying info
        event.user = {
          id: event.user.id, // Keep anonymous ID
        };
      }

      // Filter out any sensitive data in breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.data) {
            // Remove any password or token fields
            const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
            sensitiveKeys.forEach((key) => {
              if (breadcrumb.data && key in breadcrumb.data) {
                breadcrumb.data[key] = '[REDACTED]';
              }
            });
          }
          return breadcrumb;
        });
      }

      return event;
    },

    // Integration options
    integrations: [
      // Add React Native specific integrations
    ],
  });

  // Set device context
  Sentry.setContext('device', {
    brand: Device.brand,
    modelName: Device.modelName,
    osName: Device.osName,
    osVersion: Device.osVersion,
    isDevice: Device.isDevice,
  });

  // Set app context
  Sentry.setContext('app', {
    version: Application.nativeApplicationVersion,
    build: Application.nativeBuildVersion,
    expoVersion: Constants.expoVersion,
  });
}

/**
 * Set user context for error tracking
 * Only sets anonymous user ID, no PII
 */
export function setUser(userId: string | null): void {
  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Set user's grade for context (non-PII)
 */
export function setUserGrade(grade: string): void {
  Sentry.setTag('user_grade', grade);
}

/**
 * Set current screen for navigation tracking
 */
export function setCurrentScreen(screenName: string): void {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Navigated to ${screenName}`,
    level: 'info',
  });
}

/**
 * Log a custom error
 */
export function captureError(
  error: Error,
  context?: Record<string, unknown>
): string {
  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Log a custom message
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): string {
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start a performance transaction
 */
export function startTransaction(
  name: string,
  operation: string
): Sentry.Span | undefined {
  return Sentry.startInactiveSpan({
    name,
    op: operation,
  });
}

/**
 * Wrap a component with Sentry error boundary
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * HOC to wrap screens with Sentry performance tracking
 */
export function withSentryPerformance<P extends object>(
  Component: React.ComponentType<P>,
  routeName: string
): React.ComponentType<P> {
  return Sentry.withProfiler(Component, { name: routeName });
}

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
    public requestId?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Capture API error with context
 */
export function captureAPIError(
  error: APIError,
  requestDetails?: {
    method: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): string {
  Sentry.setContext('api_request', {
    endpoint: error.endpoint,
    statusCode: error.statusCode,
    requestId: error.requestId,
    method: requestDetails?.method,
    // Don't log request body as it might contain PII
  });

  return Sentry.captureException(error, {
    tags: {
      error_type: 'api_error',
      status_code: String(error.statusCode),
    },
  });
}

export default {
  initializeSentry,
  setUser,
  setUserGrade,
  setCurrentScreen,
  captureError,
  captureMessage,
  addBreadcrumb,
  startTransaction,
  captureAPIError,
  SentryErrorBoundary,
  withSentryPerformance,
};
