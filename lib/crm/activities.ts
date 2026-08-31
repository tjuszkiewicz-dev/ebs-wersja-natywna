// Helper logowania aktywności klienta (oś czasu CRM) — port z BBS-Unified (E7a).
// Best-effort: nigdy nie wywala głównej operacji.
import { admin } from '@/lib/crm/visibility';

export type ActivityType = 'NOTE' | 'CALL' | 'EMAIL' | 'MEETING' | 'SYSTEM';

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Nowy',
  IN_TALKS: 'W rozmowach',
  SIGNED: 'Podpisany',
  TERMINATED: 'Umowa Rozwiązana',
};
export const statusLabel = (s: string): string => STATUS_LABEL[s] ?? s;

export async function resolveAuthorName(userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await (admin() as any)
      .from('user_profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    return data?.full_name ?? null;
  } catch {
    return null;
  }
}

export async function logActivity(input: {
  leadId: string;
  type: ActivityType;
  body: string;
  authorId?: string | null;
  authorName?: string | null;
  isSystem?: boolean;
}): Promise<void> {
  try {
    let name = input.authorName ?? null;
    if (!name && input.authorId) name = await resolveAuthorName(input.authorId);
    await (admin() as any).from('crm_activities').insert({
      lead_id: input.leadId,
      type: input.type,
      body: input.body,
      author_id: input.authorId ?? null,
      author_name: name,
      is_system: input.isSystem ?? false,
    });
  } catch {
    /* zapis osi czasu nie może przerwać operacji głównej */
  }
}
