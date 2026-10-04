/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // MVP deploy: don't fail build on type errors
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_GOAL_PLANNING_URL: process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'http://localhost:3000',
  },
  // One privacy policy covers both apps (they share an account) and lives in
  // the Autinerary app; the footer's Privacy Policy link lands on it.
  async redirects() {
    return [
      {
        source: '/privacy',
        destination: `${process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'http://localhost:3000'}/privacy`,
        permanent: false,
      },
    ]
  },
  webpack: (config, { isServer, dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: ['**/node_modules/**', '**/.git/**'],
        poll: 1000,
      }
    }
    // Exclude native Node.js modules from webpack bundling
    // These are only needed server-side and shouldn't be bundled
    if (isServer) {
      // Mark onnxruntime-node as external for server-side
      config.externals = config.externals || []
      config.externals.push({
        'onnxruntime-node': 'commonjs onnxruntime-node',
      })
    } else {
      // For client-side, prevent bundling of native modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'onnxruntime-node': false,
        fs: false,
        path: false,
        crypto: false,
      }
    }

    // Ignore .node binary files from webpack bundling
    config.module.rules.push({
      test: /\.node$/,
      loader: 'ignore-loader',
    })

    return config
  },
};

module.exports = nextConfig;
