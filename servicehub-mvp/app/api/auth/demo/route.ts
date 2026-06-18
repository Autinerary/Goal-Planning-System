/**
 * Demo Login Endpoint
 * 
 * Returns the demo account credentials for one-click demo login.
 * Credentials: demo@resourcehub.com / DemoPassword123!
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    email: 'demo@resourcehub.com',
    password: 'DemoPassword123!',
    message: 'Use these credentials to log in as the demo user',
  })
}
