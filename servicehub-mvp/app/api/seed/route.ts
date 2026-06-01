/**
 * Development-only seeding endpoint
 * 
 * This endpoint allows easy database seeding during development.
 * 
 * Usage:
 *   POST /api/seed
 *   
 * Note: Only works in development mode. Requires SUPABASE_SERVICE_ROLE_KEY.
 */

import { seedDatabase } from '@/lib/supabase/seed'
import { NextResponse } from 'next/server'

export async function POST() {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Seeding is not allowed in production' },
      { status: 403 }
    )
  }

  // Check for service role key (required for creating auth users)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { 
        error: 'SUPABASE_SERVICE_ROLE_KEY is required for seeding. Please add it to your .env.local file.' 
      },
      { status: 500 }
    )
  }

  try {
    console.log('🌱 Starting database seeding...')
    const result = await seedDatabase()
    
      return NextResponse.json({
        ...result,
        message: 'Database seeded successfully!'
      })
  } catch (error) {
    console.error('❌ Seed error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to seed database',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}

// Also allow GET for easy browser access in development
export async function GET() {
  return POST()
}
