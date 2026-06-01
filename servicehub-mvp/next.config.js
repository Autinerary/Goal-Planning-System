/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_GOAL_PLANNING_URL: process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'http://localhost:3000',
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
