import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import * as Clipboard from 'expo-clipboard'
import type { Session } from '@supabase/supabase-js'
import { SIGNUP_KIT_SOURCE } from '../lib/signupKitSource'
import { SIGNUP_SERVICES } from '../lib/signupServices'
import { loadSignups, newPassword, recordSignup, saveDetails, splitName, type SignupInfo, type SignupStatus } from '../lib/signups'

/**
 * One-click sign-up on the phone (the web app's lib/signups.ts): each service
 * the kit can do, with Sign me up. It opens the service's own sign-up page
 * in a web view here and fills it in with the kit (lib/signupKitSource.ts,
 * generated from the web app's lib/signupKit.ts), again after each page load.
 * It stops at anything only the person can do (a robot check, a payment, a
 * code from their email) and leaves that page in front of them. The new
 * password shows once, to save; it is never kept.
 */

const FINAL = new Set(['signed_up', 'check_email', 'needs_you', 'exists', 'failed', 'timeout'])
const WORDS: Record<string, string> = {
  signed_up: 'Signed up',
  check_email: 'Check your email to finish',
  exists: 'You already have an account',
  needs_you: 'Waiting for you to finish',
  failed: 'Didn’t go through',
}

interface Run {
  service: string
  person: { firstName: string; lastName: string; email: string; password?: string }
  done: number[]
  /** Handed over to the person: closing now leaves it as it is. */
  handedOver?: boolean
}

export default function SignupScreen({ session }: { session: Session }) {
  const [info, setInfo] = useState<SignupInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [run, setRun] = useState<Run | null>(null)
  const [shown, setShown] = useState(false)
  const [password, setPassword] = useState<{ name: string; value: string } | null>(null)
  const web = useRef<WebView>(null)
  const runRef = useRef<Run | null>(null)
  runRef.current = run

  const load = useCallback(async () => {
    const i = await loadSignups()
    setInfo(i)
    const start = i?.details || splitName(i?.suggested || (session.user.user_metadata as { full_name?: string })?.full_name)
    setFirst(start.firstName)
    setLast(start.lastName)
    setLoading(false)
  }, [session])
  useEffect(() => { load() }, [load])

  const finish = async (status: string, detail?: string | null) => {
    const r = runRef.current
    if (!r) return
    const name = SIGNUP_SERVICES[r.service]?.name || r.service
    await recordSignup(r.service, status as SignupStatus, detail)
    if (status === 'needs_you') {
      // Something only they can do: the page stays in front of them, and the
      // kit carries on when they've done it (the next page load).
      setRun({ ...r, handedOver: true })
      setShown(true)
      Alert.alert(name, 'There’s a step only you can do on this page (for example “I’m not a robot”). Finish it here, then close.')
    } else {
      setShown(false)
      setRun(null)
      if ((status === 'signed_up' || status === 'check_email') && r.person.password) setPassword({ name, value: r.person.password })
      else Alert.alert(name, WORDS[status] || 'It took too long. Try again.')
    }
    load()
  }

  const close = () => {
    const r = runRef.current
    if (r?.handedOver) { setShown(false); setRun(null); load(); return }
    finish('failed', 'Closed before it finished.')
  }

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type?: string; event?: { type?: string; page?: number }; result?: { status: string; detail?: string } } | null = null
    try { m = JSON.parse(e.nativeEvent.data) } catch { return }
    const r = runRef.current
    if (!m || !r) return
    if (m.type === 'event' && m.event?.type === 'page_done' && typeof m.event.page === 'number') {
      setRun({ ...r, done: [...new Set([...r.done, m.event.page])] })
    }
    // After a hand-over, another "needs you" is no news.
    if (m.type === 'result' && m.result && FINAL.has(m.result.status) && !(r.handedOver && m.result.status === 'needs_you')) finish(m.result.status, m.result.detail)
  }

  // Each page load: run the kit there, with the pages already done.
  const onLoadEnd = () => {
    const r = runRef.current
    if (!r) return
    web.current?.injectJavaScript(`${SIGNUP_KIT_SOURCE}
;(function () {
  if (window.__autinerarySignupRunning) return;
  window.__autinerarySignupRunning = true;
  var send = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)) };
  var kit = window.AutinerarySignup;
  kit.run(kit.recipes[${JSON.stringify(r.service)}], ${JSON.stringify(r.person)}, {
    done: ${JSON.stringify(r.done)},
    onEvent: function (e) { send({ type: 'event', event: e }) }
  }).then(function (res) { send({ type: 'result', result: res }) })
    .catch(function () {})
    .finally(function () { window.__autinerarySignupRunning = false });
})();
true;`)
  }

  const signUp = async (service: string) => {
    if (!info?.email) return
    if (!info.details) {
      const err = await saveDetails({ firstName: first.trim(), lastName: last.trim() })
      if (err) { Alert.alert('Your name', err); return }
    }
    const s = SIGNUP_SERVICES[service]
    const person = { firstName: (info.details?.firstName || first).trim(), lastName: (info.details?.lastName || last).trim(), email: info.email, ...(s.kind === 'account' ? { password: newPassword() } : {}) }
    setRun({ service, person, done: [] })
    setShown(true)
  }

  if (loading) return <SafeAreaView style={styles.centre}><ActivityIndicator /></SafeAreaView>
  if (!info?.on) return <SafeAreaView style={styles.centre}><Text style={styles.body}>One-click sign-up isn’t switched on yet.</Text></SafeAreaView>
  if (!info.ready) return <SafeAreaView style={styles.centre}><Text style={styles.body}>One-click sign-up isn’t ready yet.</Text></SafeAreaView>
  if (info.refusal) return <SafeAreaView style={styles.centre}><Text style={styles.body}>{info.refusal}</Text></SafeAreaView>

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.h1}>Sign me up</Text>
        <Text style={styles.body}>Autinerary fills in each service’s own sign-up form for you, with your name and {info.email}. A new account gets its own password, shown once for you to save.</Text>
        {!info.details && (
          <View style={styles.card}>
            <Text style={styles.label}>First name</Text>
            <TextInput value={first} onChangeText={setFirst} style={styles.input} autoComplete="given-name" />
            <Text style={styles.label}>Last name</Text>
            <TextInput value={last} onChangeText={setLast} style={styles.input} autoComplete="family-name" />
            <Text style={styles.small}>Checked once. Signing up means agreeing to that service’s terms.</Text>
          </View>
        )}
        {Object.entries(SIGNUP_SERVICES).map(([key, s]) => {
          const state = info.signups?.[key]
          const settled = state && ['signed_up', 'check_email', 'exists'].includes(state.status)
          return (
            <View key={key} style={styles.card}>
              <Text style={styles.name}>{s.name}</Text>
              {s.note ? <Text style={styles.small}>{s.note}</Text> : null}
              {s.terms ? <Text style={styles.link} onPress={() => Linking.openURL(s.terms!)}>Their terms</Text> : null}
              {settled ? (
                <Text style={styles.done}>{WORDS[state!.status]}</Text>
              ) : (
                <Pressable style={styles.button} disabled={!!run} onPress={() => signUp(key)} accessibilityRole="button" accessibilityLabel={`Sign me up for ${s.name}`}>
                  <Text style={styles.buttonText}>{s.kind === 'newsletter' ? 'Subscribe me' : 'Sign me up'}</Text>
                </Pressable>
              )}
            </View>
          )
        })}
      </ScrollView>

      <Modal visible={!!run && shown} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.bar}>
            <Text style={styles.name}>{run ? `Signing you up for ${SIGNUP_SERVICES[run.service]?.name}` : ''}</Text>
            <Pressable onPress={close} accessibilityRole="button"><Text style={styles.link}>Close</Text></Pressable>
          </View>
          {run && (
            <WebView
              ref={web}
              source={{ uri: SIGNUP_SERVICES[run.service].start }}
              onLoadEnd={onLoadEnd}
              onMessage={onMessage}
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
            />
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={!!password} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.dim}>
          <View style={styles.sheet}>
            <Text style={styles.h2}>Your new {password?.name} password</Text>
            <Text style={styles.body}>Save it in your password manager now. Autinerary doesn’t keep it.</Text>
            <Text selectable style={styles.secret}>{password?.value}</Text>
            <Pressable style={styles.button} onPress={() => password && Clipboard.setStringAsync(password.value)} accessibilityRole="button"><Text style={styles.buttonText}>Copy</Text></Pressable>
            <Pressable style={[styles.button, styles.secondary]} onPress={() => setPassword(null)} accessibilityRole="button"><Text style={[styles.buttonText, { color: '#3730a3' }]}>I’ve saved it</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  wrap: { padding: 16, gap: 12 },
  h1: { fontSize: 26, fontWeight: '800', color: '#1e293b' },
  h2: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  body: { fontSize: 16, color: '#334155', lineHeight: 22 },
  small: { fontSize: 13, color: '#475569' },
  label: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 10, fontSize: 16, color: '#0f172a' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  name: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  link: { fontSize: 15, fontWeight: '700', color: '#3730a3', textDecorationLine: 'underline' },
  done: { fontSize: 15, fontWeight: '700', color: '#065f46' },
  button: { backgroundColor: '#4338ca', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#a5b4fc' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 10 },
  secret: { fontFamily: 'Courier', fontSize: 18, color: '#0f172a', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12 },
})
