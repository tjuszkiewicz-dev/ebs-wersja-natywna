import type { Metadata } from 'next';
import type React from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'EBS – Eliton Benefits System',
  description: 'System zarządzania benefitami pracowniczymi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="relative min-h-screen bg-black overflow-x-hidden">
        {children}
</body>
    </html>
  );
}
