/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // TypeScript errors will still fail the build; only ESLint is relaxed
    ignoreBuildErrors: false,
  },
  eslint: {
    // Set to false to enforce lint checks on every Vercel build.
    // Run `npm run lint` locally to fix any warnings before deploying.
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig

