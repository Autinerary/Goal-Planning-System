import { NextResponse } from 'next/server'
import { getResourceCategories } from '@/lib/supabase/queries'

export async function GET() {
  try {
    const categories = await getResourceCategories()
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error in categories API:', error)
    return NextResponse.json([], { status: 500 })
  }
}