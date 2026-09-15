/**
 * Przełącznik układu Pulpitu pracownika. 'v2' = sklep benefitów (spec 2026-09-15);
 * 'v1' = dawne karuzele partnerów. Kod v1 zostaje w DashboardEmployee/Sidebar — wyłączony, nie usunięty
 * (decyzja właściciela). Jedno miejsce prawdy dla DashboardEmployee i Sidebar.
 */
export const STORE_LAYOUT: 'v1' | 'v2' = 'v2';
