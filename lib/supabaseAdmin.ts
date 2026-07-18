// Neutralny klient service-role dla modułu agencji (BBS miał admin() w lib/crm/visibility —
// CRM jest wykluczony z EBS, więc alias wskazuje istniejący supabaseServer).
import { supabaseServer } from '@/lib/supabase';

export const admin = supabaseServer;
