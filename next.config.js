/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Keep native/wasm SQLite backends external so their files (incl. the .wasm
  // binary) are traced into the standalone node_modules rather than bundled.
  experimental: {
    serverComponentsExternalPackages: ["node-sqlite3-wasm"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        "node:sqlite": "commonjs node:sqlite",
        "node-sqlite3-wasm": "commonjs node-sqlite3-wasm",
      });
    }
    return config;
  },
};

module.exports = nextConfig;
