/** Skrzynka Biura Obsługi Klienta — ta sama, na którą idzie „Kontakt z BOK" z ustawień konta. */
export const BOK_EMAIL = process.env.BOK_EMAIL ?? 'bok@stratton-prime.pl';
/** Obietnica składana pracownikowi w potwierdzeniach (spec §5.4/§5.5). */
export const BOK_SLA_TEXT = '2 dni roboczych';
export const STORE_TITLE = 'Sklep benefitów';

/**
 * Telefon do BOK — właściciel poda numer (decyzja 2026-09-17: pozycje partnerskie zostają
 * na „Zapytaj o ofertę", a pracownik ma też dostać numer do biura). Pusty = nie pokazujemy.
 * NEXT_PUBLIC_, bo czyta go zarówno mailer (serwer), jak i sklep w przeglądarce.
 */
export const BOK_PHONE = (process.env.NEXT_PUBLIC_BOK_PHONE ?? '').trim();

/** Jedna forma kontaktu z BOK w mailach i w sklepie: „bok@…" albo „bok@…, tel. …". */
export function bokContactText(email: string = BOK_EMAIL, phone: string = BOK_PHONE): string {
  return phone ? `${email}, tel. ${phone}` : email;
}

/** Adres produkcyjny (alias Vercel `ebs.elitonbenefits.pl`) — link do panelu w mailach do BOK. */
export const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://ebs.elitonbenefits.pl').replace(/\/+$/, '');
/** Ekran „Zgłoszenia BOK" w panelu admina (mechanizm `?view=` z AdminDashboardClient). */
export const BOK_QUEUE_URL = `${APP_BASE_URL}/dashboard/admin?view=admin-zgloszenia`;
