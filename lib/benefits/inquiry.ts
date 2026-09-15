export const INQUIRY_DEDUP_DAYS = 7;

/** Czy poprzednie zgłoszenie jest na tyle świeże, że nowe byłoby dublem (spec §5.5 pkt 2). */
export function isWithinDedupWindow(lastCreatedAt: string | Date, now: Date = new Date()): boolean {
  const last = typeof lastCreatedAt === 'string' ? new Date(lastCreatedAt) : lastCreatedAt;
  const windowMs = INQUIRY_DEDUP_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - last.getTime() < windowMs;
}
