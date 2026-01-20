import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Analytics } from '../lib/analytics';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'screen' | 'component' | 'critical';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error to analytics (no sensitive data)
    const errorType = error.name || 'UnknownError';
    const componentStack = errorInfo.componentStack || '';
    const screenMatch = componentStack.match(/at (\w+Screen)/);
    const screen = screenMatch ? screenMatch[1] : 'Unknown';

    // Only log if we have a user context (analytics handles this safely)
    Analytics.errorOccurred('system', errorType, screen);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to console in dev
    if (__DEV__) {
      console.error('ErrorBoundary caught error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, level = 'component' } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Return appropriate fallback based on level
      return (
        <ErrorFallback
          error={error}
          errorInfo={errorInfo}
          level={level}
          onRetry={this.handleRetry}
        />
      );
    }

    return children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  level: 'screen' | 'component' | 'critical';
  onRetry: () => void;
}

function ErrorFallback({ error, errorInfo, level, onRetry }: ErrorFallbackProps) {
  // Critical errors show full screen message
  if (level === 'critical') {
    return (
      <View style={styles.criticalContainer}>
        <Text style={styles.criticalIcon}>😵</Text>
        <Text style={styles.criticalTitle}>Something went wrong</Text>
        <Text style={styles.criticalMessage}>
          We&apos;re sorry, but something unexpected happened. Please restart the app.
        </Text>
        {__DEV__ && error && (
          <ScrollView style={styles.devInfo}>
            <Text style={styles.devInfoText}>
              {error.toString()}
            </Text>
          </ScrollView>
        )}
      </View>
    );
  }

  // Screen-level errors
  if (level === 'screen') {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.screenIcon}>🔄</Text>
        <Text style={styles.screenTitle}>Oops!</Text>
        <Text style={styles.screenMessage}>
          This screen encountered an error. Please try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        {__DEV__ && error && (
          <ScrollView style={styles.devInfo}>
            <Text style={styles.devInfoText}>
              {error.toString()}
              {'\n\n'}
              {errorInfo?.componentStack}
            </Text>
          </ScrollView>
        )}
      </View>
    );
  }

  // Component-level errors (minimal)
  return (
    <View style={styles.componentContainer}>
      <Text style={styles.componentText}>
        Unable to load this section
      </Text>
      <TouchableOpacity onPress={onRetry}>
        <Text style={styles.componentRetry}>Tap to retry</Text>
      </TouchableOpacity>
    </View>
  );
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<Props, 'children'>
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...options}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

const styles = StyleSheet.create({
  criticalContainer: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  criticalIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  criticalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: 12,
  },
  criticalMessage: {
    fontSize: 16,
    color: '#7F1D1D',
    textAlign: 'center',
    lineHeight: 24,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  screenIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  screenMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  componentContainer: {
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    alignItems: 'center',
  },
  componentText: {
    fontSize: 14,
    color: '#92400E',
  },
  componentRetry: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
    marginTop: 8,
  },
  devInfo: {
    marginTop: 24,
    maxHeight: 200,
    width: '100%',
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
  },
  devInfoText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#F87171',
  },
});

export default ErrorBoundary;
