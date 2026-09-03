import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Platform, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import type { Session } from '@supabase/supabase-js'
import { supabase, isConfigured } from './lib/supabase'
import { fetchCurrentTask, type CurrentTask } from './lib/api'
import { startBubble, stopBubble, hasOverlayPermission, requestOverlayPermission } from './modules/floating-bubble'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [task, setTask] = useState<CurrentTask | null>(null)
  const [bubbleOn, setBubbleOn] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setBooting(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadTask = useCallback(async () => {
    if (!session?.user?.id) return
    const t = await fetchCurrentTask(session.user.id)
    setTask(t)
  }, [session])

  useEffect(() => { loadTask() }, [loadTask])

  const signIn = async () => {
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) Alert.alert('Could not sign in', error.message)
  }

  const toggleBubble = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Not available on iOS',
        'Apple does not allow apps to float over other apps. On iPhone this becomes a Live Activity instead — same idea, different shape.'
      )
      return
    }
    if (bubbleOn) {
      await stopBubble()
      setBubbleOn(false)
      return
    }
    if (!(await hasOverlayPermission())) {
      await requestOverlayPermission()
      return // user lands in system settings; they can come back and tap again
    }
    await startBubble(task?.name ?? 'Open Autinerary')
    setBubbleOn(true)
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
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Right now</Text>

        {task ? (
          <View style={styles.card}>
            <Text style={styles.milestone}>{task.milestoneName}</Text>
            <Text style={styles.task}>{task.name}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>No active task yet. Create a path in the app first.</Text>
          </View>
        )}

        <Pressable style={styles.primary} onPress={toggleBubble}>
          <Text style={styles.primaryText}>
            {bubbleOn ? 'Hide the floating mascot' : 'Float the mascot over other apps'}
          </Text>
        </Pressable>
        <Text style={styles.hint}>
          {Platform.OS === 'android'
            ? 'Drag it anywhere. Tap it to come straight back here.'
            : 'iOS does not allow floating overlays — a Live Activity is the equivalent.'}
        </Text>

        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signout}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef4ff' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#eef4ff' },
  scroll: { padding: 24, gap: 16 },
  h1: { fontSize: 28, fontWeight: '800', color: '#1e293b' },
  body: { fontSize: 14, color: '#475569', textAlign: 'center', marginTop: 8 },
  input: {
    width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginTop: 12, borderWidth: 1, borderColor: '#cbd5e1', fontSize: 15,
  },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 6 },
  milestone: { fontSize: 12, fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase' },
  task: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  primary: { backgroundColor: '#7c3aed', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  hint: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  signout: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 24 },
})
