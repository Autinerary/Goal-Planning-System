/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Type errors fail the build (the code type-checks clean since 11 Oct 2026).
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // One-click sign-up's server robot (app/api/me/signups/robot) runs a real
    // browser: these stay as installed, not bundled.
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_SERVICE_HUB_URL: process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: ['**/node_modules/**', '**/.git/**'],
        poll: 1000,
      }
    }
    return config
  },
}

module.exports = nextConfig
