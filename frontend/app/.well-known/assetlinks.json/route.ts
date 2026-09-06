import { NextResponse } from 'next/server'

/**
 * Digital Asset Links — GET /.well-known/assetlinks.json
 *
 * Required for the Google Play (TWA) build. A Trusted Web Activity only
 * drops the browser address bar if the website proves it owns the Android
 * app, and it proves that by serving this file with the app's signing
 * certificate fingerprint. Without it the "app" opens showing a URL bar,
 * which is exactly the thing that makes it not feel like an app.
 *
 * The fingerprint comes from the Play signing key and does not exist until
 * the app is registered, so it is read from env rather than hardcoded.
 *
 * Returns 404 when unconfigured rather than a file with a placeholder
 * fingerprint — a wrong fingerprint fails verification silently and is far
 * harder to debug than a missing file.
 */
export const dynamic = 'force-dynamic'

const PACKAGE_NAME = process.env.TWA_PACKAGE_NAME || 'com.autinerary.twa'

export async function GET() {
  // Play App Signing gives you this under Setup → App integrity. Accepts a
  // comma-separated list so the upload key and Play's signing key can both
  // be present during a key rotation.
  const raw = (process.env.TWA_SHA256_FINGERPRINTS || '').trim()
  if (!raw) {
    return NextResponse.json(
      { error: 'Digital Asset Links not configured. Set TWA_SHA256_FINGERPRINTS.' },
      { status: 404 }
    )
  }

  const fingerprints = raw
    .split(',')
    .map((f) => f.trim().toUpperCase())
    // SHA-256 as 32 colon-separated hex pairs. Validated because a
    // malformed entry fails verification with no useful error anywhere.
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f))

  if (fingerprints.length === 0) {
    return NextResponse.json(
      { error: 'TWA_SHA256_FINGERPRINTS is set but no entry is a valid SHA-256 fingerprint.' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: PACKAGE_NAME,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { 'Content-Type': 'application/json' } }
  )
}
