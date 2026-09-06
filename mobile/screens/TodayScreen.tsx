import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { fetchCurrentTask, type CurrentTask } from '../lib/api'
import {
  startBubble, stopBubble, hasOverlayPermission, requestOverlayPermission,
} from '../modules/floating-bubble'

/** What you're doing right now, plus the floating-mascot control. */
export default function TodayScreen({ session }: { session: Session }) {
  const [task, setTask] = useState<CurrentTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [bubbleOn, setBubbleOn] = useState(false)

  const load = useCallback(async () => {
    const t = await fetchCurrentTask(session.user.id)
    setTask(t)
    setLoading(false)
    setRefreshing(false)
  }, [session])

  useEffect(() => { load() }, [load])

  const toggleBubble = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Not available on iPhone',
        'Apple does not allow any app to float over other apps — there is no permission to request. On iPhone this becomes a Live Activity instead: same idea, different shape.'
      )
      return
    }
    if (bubbleOn) {
      await stopBubble()
      setBubbleOn(false)
      return
    }
    if (!(await hasOverlayPermission())) {
      // Overlay access cannot be granted by a dialog — it is a system
      // settings toggle, so the user leaves and comes back.
      await requestOverlayPermission()
      return
    }
    await startBubble(task?.name ?? 'Open Autinerary')
    setBubbleOn(true)
  }

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />
      }
    >
      {task ? (
        <View style={styles.card}>
          <Text style={styles.milestone}>{task.milestoneName}</Text>
          <Text style={styles.task}>{task.name}</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.body}>
            Nothing active right now. Pull down to refresh, or check your path.
          </Text>
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
          : 'iPhone does not allow floating overlays — see the note when you tap.'}
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef4ff' },
  content: { padding: 20, gap: 14 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef4ff' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 6 },
  milestone: { fontSize: 12, fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase' },
  task: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  body: { fontSize: 14, color: '#475569' },
  primary: { backgroundColor: '#7c3aed', borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  hint: { fontSize: 12, color: '#64748b', textAlign: 'center' },
})
