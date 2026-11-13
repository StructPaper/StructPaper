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
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

export default nextConfig;
