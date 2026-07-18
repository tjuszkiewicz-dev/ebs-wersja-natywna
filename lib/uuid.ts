// Jedna walidacja UUID (wcześniej dwie różne implementacje w ~12 miejscach:
// skrócona {27} vs pełna — ryzyko rozjazdu). Pełny wariant 8-4-4-4-12.
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): boolean => typeof s === 'string' && UUID_RE.test(s);

// Sanityzacja wartości do filtra PostgREST `.or(...ilike...)`: znaki `,` `(` `)` `*`
// oraz backslash rozbijają składnię filtra i mogłyby zmienić warunek — usuwamy je.
// (trzymane tu, bo to najczęściej importowany util walidacji zapytań)
export const orLike = (s: unknown): string => String(s ?? '').replace(/[,()*\\]/g, ' ').trim().slice(0, 100);
