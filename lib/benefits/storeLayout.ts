/**
 * Przełącznik układu Pulpitu pracownika. 'v2' = sklep benefitów (spec 2026-09-15);
 * 'v1' = dawne karuzele partnerów. Kod v1 zostaje w DashboardEmployee/Sidebar — wyłączony, nie usunięty
 * (decyzja właściciela). Jedno miejsce prawdy dla DashboardEmployee i Sidebar.
 */
export const STORE_LAYOUT: 'v1' | 'v2' = 'v2';

/**
 * Ekran startowy pracownika (ma znaczenie tylko przy STORE_LAYOUT = 'v2'):
 * - 'store'  — sklep benefitów JEST Pulpitem: pracownik po zalogowaniu ląduje w sklepie
 *              renderowanym wewnątrz ramki portalu (nagłówek + menu boczne zostają);
 *              decyzja właściciela z 17.09.2026 („na miejsce starego ekranu podepnij nowy sklep").
 * - 'wallet' — dawny Pulpit v2 (karta salda + statystyki + Twoje Aplikacje + kafelek
 *              „Przeglądaj benefity"), sklep otwiera się jako pełnoekranowa nakładka.
 * Kod obu wariantów zostaje w repo — powrót do starego ekranu to zmiana tej jednej wartości.
 */
export const EMPLOYEE_HOME: 'wallet' | 'store' = 'store';

/**
 * Sklep jako ekran startowy — jedna flaga dla DashboardEmployee, Sidebar, EmployeeDashboardClient
 * i GlobalSearch. Rzutowanie na string: TypeScript zawęża stałą z literałem do tej jednej wartości
 * i bez rzutowania zgłasza „porównanie bez części wspólnej", gdy właściciel przestawi przełącznik.
 */
export const STORE_IS_HOME: boolean =
  (STORE_LAYOUT as string) === 'v2' && (EMPLOYEE_HOME as string) === 'store';
