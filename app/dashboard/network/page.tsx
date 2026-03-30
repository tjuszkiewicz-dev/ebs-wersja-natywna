import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { NetworkDashboardClient } from '../_components/NetworkDashboardClient';

const NETWORK_ROLES = ['partner', 'menedzer', 'dyrektor'] as const;

export default async function NetworkDashboardPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role;
  if (!role || (!NETWORK_ROLES.includes(role as typeof NETWORK_ROLES[number]) && role !== 'superadmin')) {
    redirect('/login');
  }

  return <NetworkDashboardClient />;
}
