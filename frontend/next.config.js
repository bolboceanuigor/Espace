const createNextIntlPlugin = require('next-intl/plugin');
const packageJson = require('./package.json');
const path = require('path');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  webpack: (config) => {
    // Force React to resolve from frontend/node_modules to avoid version conflicts
    config.resolve.alias = {
      ...config.resolve.alias,
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    };
    return config;
  },
}

module.exports = withNextIntl(nextConfig)
