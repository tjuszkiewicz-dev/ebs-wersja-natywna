/** Agreguje wygasające vouchery po właścicielu (liczba sztuk + kontakt). */
export function groupExpiringByOwner(
  rows: { current_owner_id: string; owner_email: string | null; owner_name: string | null }[],
): Map<string, { email: string | null; name: string | null; count: number }> {
  const m = new Map<string, { email: string | null; name: string | null; count: number }>();
  for (const r of rows) {
    const cur = m.get(r.current_owner_id);
    if (cur) cur.count += 1;
    else m.set(r.current_owner_id, { email: r.owner_email, name: r.owner_name, count: 1 });
  }
  return m;
}
