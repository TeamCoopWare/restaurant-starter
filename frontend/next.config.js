/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'export',
  basePath: '/restaurant-starter',
  assetPrefix: '/restaurant-starter',
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
