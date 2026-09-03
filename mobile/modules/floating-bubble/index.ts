import { Platform } from 'react-native'
import { requireOptionalNativeModule } from 'expo-modules-core'

/**
 * Floating mascot that sits over other apps (Android only).
 *
 * Written in-house rather than pulled from npm: the only published option,
 * react-native-floating-bubble, was last released in Feb 2023 and declares a
 * peer dependency of react-native ^0.41.2 against our 0.86.3. Depending on an
 * abandoned package for a core feature is how the Ready Player Me integration
 * went wrong.
 *
 * iOS is deliberately a no-op. Apple does not permit any app to draw over
 * another app — there is no entitlement to request. The iOS equivalent is a
 * Live Activity, which is a separate implementation.
 */
interface FloatingBubbleNative {
  hasOverlayPermission(): Promise<boolean>
  requestOverlayPermission(): Promise<void>
  start(label: string): Promise<void>
  stop(): Promise<void>
}

// Optional, so a build without the native module (Expo Go, or iOS) returns
// null instead of throwing at import time.
const Native = requireOptionalNativeModule<FloatingBubbleNative>('FloatingBubble')

const android = Platform.OS === 'android' && Native

export async function hasOverlayPermission(): Promise<boolean> {
  if (!android) return false
  return Native!.hasOverlayPermission()
}

export async function requestOverlayPermission(): Promise<void> {
  if (!android) return
  return Native!.requestOverlayPermission()
}

/** Show the mascot with the current task as its label. */
export async function startBubble(label: string): Promise<void> {
  if (!android) return
  return Native!.start(label)
}

export async function stopBubble(): Promise<void> {
  if (!android) return
  return Native!.stop()
}

export const isBubbleSupported = Boolean(android)
