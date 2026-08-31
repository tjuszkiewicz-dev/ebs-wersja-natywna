// ─── Typy / kontrakt API ──────────────────────────────────────────────────────

export type LeadStatus = 'NEW' | 'IN_TALKS' | 'SIGNED' | 'TERMINATED';

export interface Opiekun {
  full_name: string;
  role: string;
  hierarchical_id: string;
}

export interface Contact {
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface Lead {
  id: string;
  name: string;
  nip?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  source?: string | null;
  status: LeadStatus;
  city?: string | null;
  contacts?: Contact[] | null;
  assigned_to?: string | null;
  added_by_user_id?: string | null;
  created_at: string;
  updated_at?: string;
  opiekun?: Opiekun | null;
}

export interface GusResult {
  name?: string;
  address_street?: string;
  address_city?: string;
  address_zip?: string;
  nip?: string;
  regon?: string;
  krs?: string;
  source?: string;
  error?: string;
}
