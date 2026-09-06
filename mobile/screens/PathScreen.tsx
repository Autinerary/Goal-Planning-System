import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { fetchMilestones, setMilestoneComplete, type Milestone } from '../lib/api'

/**
 * The path as a vertical trail of nodes.
 *
 * Palette is lifted from the web app's MilestoneTrail ZONE map so a dimension
 * is the same colour on phone and desktop — two codebases drifting apart on
 * something this visible would be worse than not matching at all.
 */
const ZONE: Record<string, { name: string; band: string; node: string; nodeDark: string }> = {
  education:     { name: 'Study Grove',  band: '#e6d9fb', node: '#4c1d95', nodeDark: '#2e1065' },
  workplace:     { name: 'Work Ridge',   band: '#fbe6c4', node: '#7c2d12', nodeDark: '#431407' },
  career:        { name: 'Work Ridge',   band: '#fbe6c4', node: '#7c2d12', nodeDark: '#431407' },
  relationships: { name: 'Kinship Vale', band: '#fbd3e3', node: '#831843', nodeDark: '#500724' },
  health:        { name: 'Calm Springs', band: '#c9eede', node: '#064e3b', nodeDark: '#022c22' },
  default:       { name: 'Open Road',    band: '#d5e5f8', node: '#1e3a8a', nodeDark: '#172554' },
}
const zoneFor = (d?: string) => ZONE[(d || '').toLowerCase()] || ZONE.default

export default function PathScreen({ session }: { session: Session }) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const userId = session.user.id

  const load = useCallback(async () => {
    const list = await fetchMilestones(userId)
    setMilestones(list)
    setLoading(false)
    setRefreshing(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  // Where you actually are: the first milestone NOT finished. Same rule the
  // web trail uses — the backend's `status` flag is always the first
  // milestone regardless of progress, so it cannot answer this.
  const firstUnfinished = milestones.findIndex((m) => !m.completed)
  const activeIndex = firstUnfinished === -1 ? milestones.length - 1 : firstUnfinished

  const toggle = async (m: Milestone, index: number) => {
    // Locked steps are not interactive, matching the web trail.
    if (!m.completed && index > activeIndex) return
    setBusyId(m.id)
    const next = !m.completed
    // Optimistic: the write is a single row and reverting on failure is
    // cheaper than making someone wait on a network round trip to see a tick.
    setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, completed: next } : x)))
    const ok = await setMilestoneComplete(userId, m.id, next)
    if (!ok) {
      setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, completed: !next } : x)))
    }
    setBusyId(null)
  }

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    )
  }

  if (milestones.length === 0) {
    return (
      <View style={styles.centre}>
        <Text style={styles.emptyTitle}>No path yet</Text>
        <Text style={styles.emptyBody}>
          Create one in the web app and it will appear here — same account, same data.
        </Text>
      </View>
    )
  }

  const done = milestones.filter((m) => m.completed).length

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />
      }
    >
      <Text style={styles.progress}>
        {done} of {milestones.length} done
      </Text>

      {milestones.map((m, i) => {
        const z = zoneFor(m.dimension)
        const isCurrent = i === activeIndex && !m.completed
        const locked = !m.completed && i > activeIndex

        return (
          <View key={m.id} style={styles.row}>
            {/* The connecting line, drawn behind each node except the first. */}
            {i > 0 && <View style={[styles.connector, { backgroundColor: z.band }]} />}

            <Pressable
              onPress={() => toggle(m, i)}
              disabled={locked || busyId === m.id}
              style={({ pressed }) => [
                styles.node,
                {
                  backgroundColor: m.completed ? '#059669' : locked ? '#cbd5e1' : z.node,
                  borderColor: isCurrent ? '#ffffff' : 'transparent',
                  borderWidth: isCurrent ? 3 : 0,
                  transform: [{ scale: pressed && !locked ? 0.94 : 1 }],
                },
              ]}
            >
              <Text style={styles.nodeText}>
                {m.completed ? '✓' : locked ? '🔒' : String(i + 1)}
              </Text>
            </Pressable>

            <View style={styles.labelWrap}>
              <Text
                style={[
                  styles.name,
                  m.completed && styles.nameDone,
                  locked && styles.nameLocked,
                ]}
                numberOfLines={2}
              >
                {m.name}
              </Text>
              <Text style={styles.zone}>
                {z.name}
                {isCurrent ? ' · you are here' : ''}
              </Text>
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef4ff' },
  content: { padding: 20, paddingBottom: 48 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#eef4ff' },
  progress: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, position: 'relative' },
  connector: { position: 'absolute', left: 25, top: -20, width: 4, height: 22, borderRadius: 2 },
  node: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  nodeText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  labelWrap: { flex: 1, marginLeft: 14 },
  name: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  nameDone: { color: '#059669', textDecorationLine: 'line-through' },
  nameLocked: { color: '#94a3b8' },
  zone: { fontSize: 11, color: '#7c3aed', marginTop: 2, fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 6 },
  emptyBody: { fontSize: 14, color: '#64748b', textAlign: 'center' },
})
