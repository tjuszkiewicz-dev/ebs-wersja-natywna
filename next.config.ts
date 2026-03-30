import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Strony dynamiczne z danymi użytkownika — nie cachujemy
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

export default nextConfig;
