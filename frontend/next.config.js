/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    API_URL: process.env.API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_SERVICE_HUB_URL: process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001',
  },
}

module.exports = nextConfig
