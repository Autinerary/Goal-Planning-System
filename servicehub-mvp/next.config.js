/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
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
