/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Allow production builds to complete even when ESLint reports warnings.
    // Fix warnings locally over time; they won't block Vercel deploys.
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig

