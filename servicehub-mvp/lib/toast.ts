/**
 * Toast notification utilities
 * Uses react-hot-toast for lightweight, accessible notifications
 */

import toast from 'react-hot-toast'

export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
      ariaLive: 'polite',
    })
  },

  error: (message: string) => {
    toast.error(message, {
      duration: 4000,
      position: 'top-right',
      ariaLive: 'assertive',
    })
  },

  info: (message: string) => {
    toast(message, {
      duration: 3000,
      position: 'top-right',
      icon: 'ℹ️',
      ariaLive: 'polite',
    })
  },

  loading: (message: string) => {
    return toast.loading(message, {
      position: 'top-right',
      ariaLive: 'polite',
    })
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((result: T) => string)
      error: string | ((error: Error) => string)
    }
  ) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      {
        position: 'top-right',
        ariaLive: 'polite',
      }
    )
  },
}

export { toast }