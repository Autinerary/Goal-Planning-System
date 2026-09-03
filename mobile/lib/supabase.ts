import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client for the mobile app.
 *
 * Same project as the two web apps — one database, one set of accounts, so a
 * user signs in here with the credentials they already have.
 *
 * detectSessionInUrl must be false: that option exists for browser OAuth
 * redirects and there is no URL bar on a phone.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
