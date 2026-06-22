/**
 * /api/community/profiles/me
 *   GET   — fetch the viewer's own profile (including private flags).
 *   POST  — opt-in: create the profile row (with a generated pseudonym).
 *
 * Convenience endpoint so the settings page doesn't have to know the user's
 * ID before calling the parameterised /profiles/[id] route.
 */

import { NextResponse } from 'next/server';
import {
  getCommunityServiceClient,
  getCommunityViewer,
} from '@/lib/community/client';
import { generatePseudonym } from '@/lib/community/pseudonym';

export const dynamic = 'force-dynamic';

export async function GET() {
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ error: 'Community is not configured' }, { status: 503 });
  }
  const viewer = await getCommunityViewer();
  if (!viewer) return NextResponse.json({ profile: null });

  const { data: profile } = await client
    .from('community_profiles')
    .select('*')
    .eq('user_id', viewer.user_id)
    .maybeSingle();
  return NextResponse.json({ profile, user_id: viewer.user_id, is_admin: viewer.is_admin });
}

export async function POST() {
  const client = getCommunityServiceClient();
  if (!client) {
    return NextResponse.json({ error: 'Community is not configured' }, { status: 503 });
  }
  const viewer = await getCommunityViewer();
  if (!viewer) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });

  const { data: existing } = await client
    .from('community_profiles')
    .select('user_id, pseudonym')
    .eq('user_id', viewer.user_id)
    .maybeSingle();
  if (existing) return NextResponse.json({ profile: existing, created: false });

  for (let i = 0; i < 5; i++) {
    const candidate = generatePseudonym();
    const { data: row, error } = await client
      .from('community_profiles')
      .insert({ user_id: viewer.user_id, pseudonym: candidate })
      .select('*')
      .single();
    if (!error && row) {
      return NextResponse.json({ profile: row, created: true }, { status: 201 });
    }
    if (error && !error.message?.includes('duplicate')) {
      console.error('[community] opt-in failed:', error.message);
      return NextResponse.json({ error: 'Opt-in failed' }, { status: 500 });
    }
  }
  return NextResponse.json({ error: 'Could not allocate a unique pseudonym' }, { status: 500 });
}
