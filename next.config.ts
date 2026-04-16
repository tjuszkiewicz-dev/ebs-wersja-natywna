import type { NextConfig } from 'next';

// Zbierz wszystkie dozwolone originy dla Server Actions
// Vercel generuje różne URL dla różnych deployów — dodajemy wszystkie warianty
const allowedOrigins = ['localhost:3010', 'localhost:3011'];

// Główna domena produkcyjna z NEXT_PUBLIC_APP_URL
if (process.env.NEXT_PUBLIC_APP_URL) {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_APP_URL).host;
    if (!allowedOrigins.includes(host)) allowedOrigins.push(host);
  } catch { /* nieprawidłowy URL — ignoruj */ }
}

// Vercel preview URL z VERCEL_URL (automatycznie ustawiany przez Vercel)
// Format: project-name-xxx.vercel.app
if (process.env.VERCEL_URL) {
  const vercelHost = process.env.VERCEL_URL; // Vercel nie dodaje protokołu
  if (!allowedOrigins.includes(vercelHost)) allowedOrigins.push(vercelHost);
}

// Vercel Branch URL
if (process.env.VERCEL_BRANCH_URL) {
  const branchHost = process.env.VERCEL_BRANCH_URL;
  if (!allowedOrigins.includes(branchHost)) allowedOrigins.push(branchHost);
}

const nextConfig: NextConfig = {
  // xlsx jest biblioteką CJS — bez transpilePackages webpack 5 zgłasza
  // "__webpack_modules__[moduleId] is not a function" w runtime przeglądarki
  transpilePackages: ['xlsx'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
