/**
 * Podstawia pola-zmienne postaci {{klucz}} (dopuszcza spacje: {{ klucz }}).
 * Znane klucze zamienia na String(vars[klucz] ?? ''); nieznane pozostawia bez zmian.
 */
export function renderTemplate(
  html: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? '') : match,
  );
}
