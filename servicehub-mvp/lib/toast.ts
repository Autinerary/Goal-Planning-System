/**
 * Toast notification utilities
 * Uses react-hot-toast for lightweight, accessible notifications.
 *
 * How a screen reader announces a toast is set with ariaProps. These used an
 * option react-hot-toast doesn't have, so it was ignored and errors were
 * announced like any other message.
 */

import toast from 'react-hot-toast'

export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
      ariaProps: { role: 'status', 'aria-live': 'polite' },
    })
  },

  error: (message: string) => {
    toast.error(message, {
      duration: 4000,
      position: 'top-right',
      ariaProps: { role: 'alert', 'aria-live': 'assertive' },
    })
  },

  info: (message: string) => {
    toast(message, {
      duration: 3000,
      position: 'top-right',
      icon: 'ℹ️',
      ariaProps: { role: 'status', 'aria-live': 'polite' },
    })
  },

  loading: (message: string) => {
    return toast.loading(message, {
      position: 'top-right',
      ariaProps: { role: 'status', 'aria-live': 'polite' },
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
        ariaProps: { role: 'status', 'aria-live': 'polite' },
      }
    )
  },
}

export { toast }