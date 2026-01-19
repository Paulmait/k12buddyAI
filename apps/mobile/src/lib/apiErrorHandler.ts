/**
 * API Error Handler - Graceful degradation for API failures
 */

export type ErrorType =
  | 'network'
  | 'timeout'
  | 'server'
  | 'auth'
  | 'validation'
  | 'rate_limit'
  | 'unknown';

export interface ApiError {
  type: ErrorType;
  message: string;
  userMessage: string;
  statusCode?: number;
  retryable: boolean;
  originalError?: unknown;
}

// User-friendly error messages
const USER_MESSAGES: Record<ErrorType, string> = {
  network: "Can't connect to the internet. Check your connection and try again.",
  timeout: "The request is taking too long. Please try again.",
  server: "Something went wrong on our end. We're working on it!",
  auth: "Your session has expired. Please sign in again.",
  validation: "Something doesn't look right. Please check your input.",
  rate_limit: "You're doing great! Take a short break and try again in a minute.",
  unknown: "Something unexpected happened. Please try again.",
};

/**
 * Parse an error into a structured ApiError
 */
export function parseApiError(error: unknown): ApiError {
  // Network errors (fetch failed, no connection)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: error.message,
      userMessage: USER_MESSAGES.network,
      retryable: true,
      originalError: error,
    };
  }

  // Handle Response objects (from fetch)
  if (error instanceof Response) {
    return parseResponseError(error);
  }

  // Handle Error objects
  if (error instanceof Error) {
    // Timeout errors
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return {
        type: 'timeout',
        message: error.message,
        userMessage: USER_MESSAGES.timeout,
        retryable: true,
        originalError: error,
      };
    }

    // Network errors
    if (error.message.includes('network') || error.message.includes('Network')) {
      return {
        type: 'network',
        message: error.message,
        userMessage: USER_MESSAGES.network,
        retryable: true,
        originalError: error,
      };
    }

    return {
      type: 'unknown',
      message: error.message,
      userMessage: USER_MESSAGES.unknown,
      retryable: true,
      originalError: error,
    };
  }

  // Handle plain objects with status codes
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    if (typeof errorObj.status === 'number') {
      return parseStatusCode(errorObj.status, errorObj.message as string);
    }
  }

  // Default unknown error
  return {
    type: 'unknown',
    message: String(error),
    userMessage: USER_MESSAGES.unknown,
    retryable: true,
    originalError: error,
  };
}

/**
 * Parse a fetch Response error
 */
function parseResponseError(response: Response): ApiError {
  return parseStatusCode(response.status, response.statusText);
}

/**
 * Parse HTTP status code into ApiError
 */
function parseStatusCode(status: number, message?: string): ApiError {
  // Auth errors (401, 403)
  if (status === 401 || status === 403) {
    return {
      type: 'auth',
      message: message || 'Authentication required',
      userMessage: USER_MESSAGES.auth,
      statusCode: status,
      retryable: false,
    };
  }

  // Validation errors (400, 422)
  if (status === 400 || status === 422) {
    return {
      type: 'validation',
      message: message || 'Validation error',
      userMessage: USER_MESSAGES.validation,
      statusCode: status,
      retryable: false,
    };
  }

  // Rate limiting (429)
  if (status === 429) {
    return {
      type: 'rate_limit',
      message: message || 'Too many requests',
      userMessage: USER_MESSAGES.rate_limit,
      statusCode: status,
      retryable: true,
    };
  }

  // Server errors (500+)
  if (status >= 500) {
    return {
      type: 'server',
      message: message || 'Server error',
      userMessage: USER_MESSAGES.server,
      statusCode: status,
      retryable: true,
    };
  }

  // Other client errors
  if (status >= 400) {
    return {
      type: 'unknown',
      message: message || `HTTP ${status}`,
      userMessage: USER_MESSAGES.unknown,
      statusCode: status,
      retryable: false,
    };
  }

  // Unknown
  return {
    type: 'unknown',
    message: message || `Unexpected status ${status}`,
    userMessage: USER_MESSAGES.unknown,
    statusCode: status,
    retryable: true,
  };
}

/**
 * Retry configuration for exponential backoff
 */
interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Execute an async function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: RetryConfig
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = parseApiError(error);

      // Don't retry non-retryable errors
      if (!lastError.retryable) {
        throw lastError;
      }

      // Don't retry if we've exhausted retries
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 500,
        maxDelayMs
      );

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This shouldn't be reached, but TypeScript needs it
  throw lastError || new Error('Retry failed');
}

/**
 * Create a timeout-wrapped fetch
 */
export async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw response;
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default {
  parseApiError,
  withRetry,
  fetchWithTimeout,
};
