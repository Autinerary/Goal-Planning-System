import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Pressable, SafeAreaView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { Session } from '@supabase/supabase-js'
import { supabase, isConfigured } from './lib/supabase'
import PathScreen from './screens/PathScreen'
import TodayScreen from './screens/TodayScreen'

const Tab = createBottomTabNavigator()

/**
 * App shell: auth, then tabs.
 *
 * Signing in uses the same Supabase project as both web apps, so a tester
 * signs in with the account they already have and sees the same data —
 * there is no separate mobile account system to keep in sync.
 */
export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setBooting(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = async () => {
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (error) Alert.alert('Could not sign in', error.message)
  }

  if (!isConfigured) {
    return (
      <SafeAreaView style={styles.centre}>
        <Text style={styles.h1}>Not configured</Text>
        <Text style={styles.body}>
          Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart.
        </Text>
      </SafeAreaView>
    )
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.centre}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </SafeAreaView>
    )
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.centre}>
        <StatusBar style="dark" />
        <Text style={styles.h1}>Autinerary</Text>
        <Text style={styles.body}>Sign in with the account you already use.</Text>
        <TextInput
          style={styles.input} placeholder="Email" autoCapitalize="none"
          keyboardType="email-address" value={email} onChangeText={setEmail}
        />
        <TextInput
          style={styles.input} placeholder="Password" secureTextEntry
          value={password} onChangeText={setPassword}
        />
        <Pressable style={styles.primary} onPress={signIn} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#7c3aed',
          tabBarInactiveTintColor: '#94a3b8',
          headerStyle: { backgroundColor: '#eef4ff' },
          headerTitleStyle: { fontWeight: '800', color: '#1e293b' },
        }}
      >
        <Tab.Screen
          name="Today"
          options={{ tabBarIcon: ({ color }) => <TabIcon glyph="🎯" color={color} /> }}
        >
          {() => <TodayScreen session={session} />}
        </Tab.Screen>
        <Tab.Screen
          name="Path"
          options={{ tabBarIcon: ({ color }) => <TabIcon glyph="🗺️" color={color} /> }}
        >
          {() => <PathScreen session={session} />}
        </Tab.Screen>
        <Tab.Screen
          name="Account"
          options={{ tabBarIcon: ({ color }) => <TabIcon glyph="👤" color={color} /> }}
        >
          {() => (
            <SafeAreaView style={styles.centre}>
              <Text style={styles.body}>{session.user.email}</Text>
              <Pressable onPress={() => supabase.auth.signOut()}>
                <Text style={styles.signout}>Sign out</Text>
              </Pressable>
            </SafeAreaView>
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  )
}

/** Emoji tab icons — deliberately no icon-font dependency for three tabs. */
function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#eef4ff' },
  h1: { fontSize: 28, fontWeight: '800', color: '#1e293b' },
  body: { fontSize: 14, color: '#475569', textAlign: 'center', marginTop: 8 },
  input: {
    width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginTop: 12, borderWidth: 1, borderColor: '#cbd5e1', fontSize: 15,
  },
  primary: { backgroundColor: '#7c3aed', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 12, width: '100%' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  signout: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 20 },
})
