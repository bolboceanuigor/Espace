const createNextIntlPlugin = require('next-intl/plugin');
const packageJson = require('./package.json');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
}

module.exports = withNextIntl(nextConfig)
