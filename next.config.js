/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    compress: true,
    poweredByHeader: false,
    productionBrowserSourceMaps: false,
    // For Docker
    experimental: {
        // Optimize for Docker builds
        optimizeFonts: true,
    },
}

module.exports = nextConfig