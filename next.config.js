/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    swcMinify: true,
    compress: true,
    poweredByHeader: false,
    productionBrowserSourceMaps: false,
    experimental: {
        optimizeFonts: true,
    },
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.resolve.alias['canvas'] = false;
        }
        return config;
    },
}

module.exports = nextConfig