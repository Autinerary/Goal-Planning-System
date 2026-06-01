import { NextRequest, NextResponse } from 'next/server'
import { getSearchSuggestions } from '@/lib/supabase/queries'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const limit = Number(searchParams.get('limit') || '5')

    if (!query || query.length < 2) {
      return NextResponse.json([])
    }

    const suggestions = await getSearchSuggestions(query, limit)
    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('Error in search suggestions API:', error)
    return NextResponse.json([], { status: 500 })
  }
}