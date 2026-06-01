import { createClient } from '@/lib/supabase/server'

export type ErrorType =
  | 'network'
  | 'server'
  | 'not-found'
  | 'unauthorized'
  | 'validation'
  | 'rate-limit'
  | 'unknown'

export interface AppError extends Error {
  type?: ErrorType
  statusCode?: number
  code?: string
  userMessage?: string
}

/**
 * Format error for user display
 */
export function formatErrorForUser(error: unknown): {
  message: string
  type: ErrorType
  title?: string
} {
  if (error instanceof Error) {
    const appError = error as AppError

    // Check for network errors
    if (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch')
    ) {
      return {
        message: 'Unable to connect to the server. Please check your internet connection and try again.',
        type: 'network',
        title: 'Connection Error',
      }
    }

    // Check for Supabase rate limit errors
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return {
        message: 'Too many requests. Please wait a moment and try again.',
        type: 'rate-limit',
        title: 'Rate Limit Exceeded',
      }
    }

    // Check for 404 errors
    if (error.message.includes('not found') || error.message.includes('404') || appError.statusCode === 404) {
      return {
        message: 'The resource you\'re looking for doesn\'t exist or has been removed.',
        type: 'not-found',
        title: 'Not Found',
      }
    }

    // Check for unauthorized errors
    if (
      error.message.includes('unauthorized') ||
      error.message.includes('permission') ||
      error.message.includes('403') ||
      appError.statusCode === 401 ||
      appError.statusCode === 403
    ) {
      return {
        message: 'You don\'t have permission to access this resource. Please sign in or contact support.',
        type: 'unauthorized',
        title: 'Access Denied',
      }
    }

    // Check for validation errors
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return {
        message: appError.userMessage || error.message,
        type: 'validation',
        title: 'Validation Error',
      }
    }

    // Check for server errors
    if (
      error.message.includes('500') ||
      error.message.includes('server error') ||
      appError.statusCode === 500
    ) {
      return {
        message: 'A server error occurred. Please try again or contact support if the problem persists.',
        type: 'server',
        title: 'Server Error',
      }
    }

    // Use custom user message if available
    if (appError.userMessage) {
      return {
        message: appError.userMessage,
        type: appError.type || 'unknown',
        title: appError.type === 'validation' ? 'Validation Error' : undefined,
      }
    }

    // Default error message
    return {
      message: error.message || 'An unexpected error occurred. Please try again.',
      type: appError.type || 'unknown',
    }
  }

  // Handle non-Error objects
  if (typeof error === 'string') {
    return {
      message: error,
      type: 'unknown',
    }
  }

  return {
    message: 'An unexpected error occurred. Please try again.',
    type: 'unknown',
  }
}

/**
 * Create an AppError instance
 */
export function createAppError(
  message: string,
  type: ErrorType = 'unknown',
  options?: {
    statusCode?: number
    code?: string
    userMessage?: string
  }
): AppError {
  const error = new Error(message) as AppError
  error.type = type
  error.statusCode = options?.statusCode
  error.code = options?.code
  error.userMessage = options?.userMessage || message
  return error
}

/**
 * Check if device is online
 */
export function isOnline(): boolean {
  if (typeof window === 'undefined') return true
  return navigator.onLine
}

/**
 * Handle network errors
 */
export async function handleNetworkError(error: unknown): Promise<never> {
  if (!isOnline()) {
    throw createAppError(
      'No internet connection',
      'network',
      {
        userMessage: 'You appear to be offline. Please check your internet connection and try again.',
      }
    )
  }

  const formatted = formatErrorForUser(error)
  throw createAppError(formatted.message, formatted.type)
}

/**
 * Log error (can be extended to send to error tracking service)
 */
export async function logError(
  error: unknown,
  context?: {
    userId?: string
    path?: string
    action?: string
    metadata?: Record<string, any>
  }
): Promise<void> {
  const errorInfo = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    type: error instanceof Error && 'type' in error ? (error as AppError).type : 'unknown',
    timestamp: new Date().toISOString(),
    ...context,
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error logged:', errorInfo)
  }

  // In production, you could send to Supabase logs or error tracking service
  // For now, we'll just log to console
  // Example: Send to Supabase Edge Function for error tracking
  /*
  try {
    const supabase = createClient()
    await supabase.functions.invoke('log-error', {
      body: errorInfo,
    })
  } catch (logError) {
    console.error('Failed to log error:', logError)
  }
  */
}

/**
 * Wrap async functions with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: {
    action?: string
    userId?: string
  }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      await logError(error, {
        action: context?.action || fn.name,
        userId: context?.userId,
      })
      throw error
    }
  }) as T
}