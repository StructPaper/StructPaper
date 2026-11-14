/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_EXPORT === 'true';
const isStandalone = process.env.NEXT_STANDALONE === 'true';

const nextConfig = {
  output: isExport ? 'export' : (isStandalone ? 'standalone' : undefined),
  images: {
    unoptimized: isExport ? true : undefined,
  },
  transpilePackages: [
    '@structpaper/doc-model',
    '@structpaper/editor-core',
    '@structpaper/storage',
    '@structpaper/ingest-docx',
    '@structpaper/journal-profiles',
    '@structpaper/qc-engine',
    '@structpaper/exporters',
    '@structpaper/compiler-client',
    'framer-motion',
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    const backendUrl =
      process.env.INTERNAL_API_URL ||
      process.env.API_SERVER_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3001';
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${process.env.INTERNAL_API_URL || 'http://localhost:3001'}/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

export default nextConfig;
