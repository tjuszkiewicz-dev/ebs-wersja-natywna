import type React from 'react';

// Layout chroniony — middleware gwarantuje że user jest zalogowany
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
