import type { Metadata } from 'next';
import type React from 'react';
import './globals.css';
import SoftAurora from '@/components/SoftAurora';

export const metadata: Metadata = {
  title: 'EBS – Eliton Benefits System',
  description: 'System zarządzania benefitami pracowniczymi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="relative min-h-screen bg-black overflow-x-hidden">
        {/* Warstwa aury – za całą treścią */}
        <SoftAurora
          colors={['#00ff41', '#00cc33', '#003d1a', '#00ff88', '#004d00']}
          speed={0.8}
          blur={90}
          opacity={0.55}
        />

        {/* Ciemna nakładka dla czytelności treści */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.45)', zIndex: 1 }}
          aria-hidden="true"
        />

        {/* Treść aplikacji */}
        <div className="relative" style={{ zIndex: 2 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
