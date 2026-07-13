# SP2 — Kartoteka: utwardzenie IBAN — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development lub superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** IBAN pracownika jest walidowany (mod-97) i normalizowany (26-cyfrowy NRB → `PL…`) we wszystkich ścieżkach wejścia (formularz kartoteki, import Excel, bulk-import), a `iban_verified` jest spójne (każdy nowo wprowadzony IBAN = niezweryfikowany).

**Architecture:** Rozszerzamy istniejący `lib/iban.ts` (z SP1) o `normalizeIBAN` (doklejenie `PL` do 26 cyfr) — testowalny rdzeń. Wpinamy `normalizeIBAN`+`isValidIBAN` w: serwerowy `PATCH /finance`, `bulk-import`, oba parsery Excel (`utils/excelHr.ts`), oraz żywy walidator inline w `DashboardNewHR` (zastępując lokalny duplikat `validateIBAN`). Usuwamy martwy `EmployeeEditModal`.

**Tech Stack:** Next.js 15, Supabase, TypeScript, Vitest, Zod, xlsx.

## Global Constraints

- Współdzielony walidator/normalizator: `lib/iban.ts` (`isValidIBAN` już istnieje z SP1). NIE tworzyć nowych kopii walidatora.
- **Normalizacja:** wejście oczyszczone ze spacji, wielkie litery; jeśli pasuje do `^\d{26}$` (polski NRB bez kodu kraju) → poprzedzić `PL`. Zapis do DB = postać znormalizowana (z kodem kraju).
- `iban_verified`: każdy **nowo wprowadzony/zmieniony** IBAN ustawia `iban_verified=false` (weryfikacja to osobny krok superadmina). Dotyczy `bulk-import` (dziś błędnie `true`) i `finance` (gdy zmienia IBAN bez jawnego `iban_verified`).
- Pusty IBAN dozwolony (pole opcjonalne) — nie waliduj pustego.
- Testy przez `npx vitest run`; brak infry do testów route/React/Excel-File → dla tych zmian kroki = `tsc`+`build`+weryfikacja manualna. Rdzeń (`normalizeIBAN`) ma testy jednostkowe.
- `npx tsc --noEmit` = 0 błędów i `npm run build` = sukces po zadaniach dotykających TS/React.

---

### Task 1: `normalizeIBAN` w `lib/iban.ts` (+ testy)

**Files:**
- Modify: `lib/iban.ts`
- Modify: `lib/iban.test.ts`

**Interfaces:**
- Produces: `normalizeIBAN(raw: string): string` — oczyszcza, upper-case, dokleja `PL` do 26-cyfrowego NRB; w innym razie zwraca oczyszczoną wartość bez zmian.

- [ ] **Step 1: Dopisz failing testy do `lib/iban.test.ts`**

Dodaj na końcu pliku:
```ts
import { normalizeIBAN } from './iban';

describe('normalizeIBAN', () => {
  it('dokleja PL do 26-cyfrowego NRB', () => {
    expect(normalizeIBAN('61 1090 1014 0000 0712 1981 2874')).toBe('PL61109010140000071219812874');
  });
  it('zostawia IBAN z kodem kraju (usuwa spacje, upper-case)', () => {
    expect(normalizeIBAN('pl61 1090 1014 0000 0712 1981 2874')).toBe('PL61109010140000071219812874');
  });
  it('nie zmienia wartości niebędącej 26-cyfrowym NRB', () => {
    expect(normalizeIBAN('GB82WEST12345698765432')).toBe('GB82WEST12345698765432');
    expect(normalizeIBAN('')).toBe('');
  });
  it('znormalizowany 26-cyfrowy NRB przechodzi isValidIBAN', () => {
    expect(isValidIBAN(normalizeIBAN('61 1090 1014 0000 0712 1981 2874'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`normalizeIBAN` nie istnieje)

Run: `npx vitest run lib/iban.test.ts`
Expected: FAIL — brak eksportu `normalizeIBAN`.

- [ ] **Step 3: Dodaj `normalizeIBAN` do `lib/iban.ts`**

```ts
/**
 * Normalizuje numer konta do postaci IBAN: usuwa spacje, wielkie litery,
 * a polski 26-cyfrowy NRB (bez kodu kraju) poprzedza „PL".
 */
export function normalizeIBAN(raw: string): string {
  const s = (raw || '').replace(/\s+/g, '').toUpperCase();
  return /^\d{26}$/.test(s) ? `PL${s}` : s;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run lib/iban.test.ts`
Expected: PASS (9 testów: 5 poprzednich + 4 nowe).

- [ ] **Step 5: Commit**

```bash
git add lib/iban.ts lib/iban.test.ts
git commit -m "feat(iban): normalizeIBAN (26-cyfrowy NRB -> PL) + testy"
```

---

### Task 2: Serwerowy `/finance` — walidacja + normalizacja + spójne `iban_verified`

**Files:**
- Modify: `app/api/users/[id]/finance/route.ts`

**Interfaces:**
- Consumes: `isValidIBAN`, `normalizeIBAN` z `@/lib/iban`.

- [ ] **Step 1: Import + walidacja w schemacie**

Na górze pliku dodaj: `import { isValidIBAN, normalizeIBAN } from '@/lib/iban';`
Zamień `FinanceSchema`:
```ts
const FinanceSchema = z.object({
    iban:          z.string().optional().refine(v => !v || isValidIBAN(normalizeIBAN(v)), 'Nieprawidłowy numer rachunku (IBAN)'),
    iban_verified: z.boolean().optional(),
});
```

- [ ] **Step 2: Normalizuj przy zapisie + wymuś iban_verified=false przy zmianie IBAN**

Zamień blok budujący `update`:
```ts
    const supabase2 = supabaseServer();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.iban !== undefined) {
        update.iban = parsed.data.iban ? normalizeIBAN(parsed.data.iban) : null;
        // Zmiana IBAN kasuje weryfikację, chyba że jawnie podano iban_verified
        if (parsed.data.iban_verified === undefined) {
            update.iban_verified = false;
            update.iban_verified_at = null;
        }
    }
    if (parsed.data.iban_verified !== undefined) {
        update.iban_verified = parsed.data.iban_verified;
        update.iban_verified_at = parsed.data.iban_verified ? new Date().toISOString() : null;
    }
```

- [ ] **Step 3: Typecheck + manual verify**

Run: `npx tsc --noEmit` → brak błędów w tym pliku.
Manual (dev): `PATCH /api/users/<id>/finance` z `{"iban":"61 1090 1014 0000 0712 1981 2874"}` → 200, w bazie `iban='PL61109010140000071219812874'`, `iban_verified=false`. Z błędnym IBAN → 400.

- [ ] **Step 4: Commit**

```bash
git add "app/api/users/[id]/finance/route.ts"
git commit -m "feat(finance): walidacja mod-97 + normalizacja IBAN, zmiana IBAN kasuje weryfikacje"
```

---

### Task 3: `bulk-import` — normalizacja + `iban_verified=false`

**Files:**
- Modify: `app/api/users/bulk-import/route.ts`

**Interfaces:**
- Consumes: `normalizeIBAN` z `@/lib/iban`.

- [ ] **Step 1: Import + normalizacja rawIban**

Na górze pliku dodaj `import { normalizeIBAN } from '@/lib/iban';`.
Znajdź `const rawIban = row.iban ? row.iban.replace(/\s+/g, '').toUpperCase() : null;` i zamień na:
```ts
        const rawIban = row.iban ? normalizeIBAN(row.iban) : null;
```

- [ ] **Step 2: `iban_verified=false` (import zawsze niezweryfikowany)**

Zamień:
```ts
                iban_verified: !!rawIban,
                iban_verified_at: rawIban ? now : null,
```
na:
```ts
                iban_verified: false,
                iban_verified_at: null,
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` → brak błędów w pliku.
```bash
git add app/api/users/bulk-import/route.ts
git commit -m "fix(bulk-import): normalizuj IBAN, iban_verified=false przy imporcie"
```

---

### Task 4: Parsery Excela — walidacja IBAN

**Files:**
- Modify: `utils/excelHr.ts` (parser zamówienia ~508-525 oraz parser kartoteki ~592-605)

**Interfaces:**
- Consumes: `isValidIBAN`, `normalizeIBAN` z `@/lib/iban`.

- [ ] **Step 1: Import**

Na górze `utils/excelHr.ts` dodaj: `import { isValidIBAN, normalizeIBAN } from '@/lib/iban';`

- [ ] **Step 2: Walidacja w parserze zamówienia (`parseExcelFile`)**

Po linii `const iban = String(pick(row, colIdx.iban, 13) ?? '').trim();` (i przed `return {`), w bloku walidacji dodaj:
```ts
    if (iban && !isValidIBAN(normalizeIBAN(iban))) errors.push('Nieprawidłowy numer IBAN (weryfikacja mod-97)');
```

- [ ] **Step 3: Walidacja w parserze kartoteki (`parseKartotekaFile`)**

Po linii `const iban = String(pick(row, colIdx.iban, 12) ?? '').trim();` dodaj analogicznie:
```ts
    if (iban && !isValidIBAN(normalizeIBAN(iban))) errors.push('Nieprawidłowy numer IBAN (weryfikacja mod-97)');
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` → brak błędów w `utils/excelHr.ts`.
```bash
git add utils/excelHr.ts
git commit -m "feat(excel): walidacja IBAN (mod-97) w parserach zamowienia i kartoteki"
```

---

### Task 5: `DashboardNewHR` — użyj wspólnego walidatora

**Files:**
- Modify: `views/DashboardNewHR.tsx` (usuń lokalny `validateIBAN` ~948; użycie ~1032)

**Interfaces:**
- Consumes: `isValidIBAN`, `normalizeIBAN` z `@/lib/iban`.

- [ ] **Step 1: Import**

W imports `views/DashboardNewHR.tsx` dodaj: `import { isValidIBAN, normalizeIBAN } from '@/lib/iban';`

- [ ] **Step 2: Usuń lokalny `validateIBAN`**

Usuń całą lokalną definicję `function validateIBAN(raw: string): boolean { ... }` (~948). (Jeśli używa pomocniczych zmiennych tylko dla siebie — usuń je razem.)

- [ ] **Step 3: Podmień użycie**

W miejscu `if (ibanVal && !validateIBAN(ibanVal)) { setEditError('Nieprawidłowy numer IBAN (weryfikacja mod97)'); return; }` (~1032) zamień na walidację znormalizowaną i zapis znormalizowany:
```ts
        if (ibanVal && !isValidIBAN(normalizeIBAN(ibanVal))) { setEditError('Nieprawidłowy numer IBAN (weryfikacja mod97)'); return; }
```
Jeśli w pobliżu jest `PATCH /finance` z `iban: ibanVal` — wyślij `iban: ibanVal ? normalizeIBAN(ibanVal) : ''` (serwer i tak normalizuje, ale spójnie). Sprawdź kontekst i zachowaj istniejący `iban_verified:false`.

- [ ] **Step 4: Typecheck + build + commit**

Run: `npx tsc --noEmit` → 0. `npm run build` → sukces.
```bash
git add views/DashboardNewHR.tsx
git commit -m "refactor(hr): DashboardNewHR uzywa wspoldzielonego isValidIBAN/normalizeIBAN"
```

---

### Task 6: Usuń martwy `EmployeeEditModal`

**Files:**
- Delete: `components/hr/modals/EmployeeEditModal.tsx`

- [ ] **Step 1: Potwierdź 0 żywych importów**

Run: `grep -rn "EmployeeEditModal" --include=*.tsx --include=*.ts .`
Expected: brak importów z żywych plików (tylko ewentualnie sam plik). Jeśli jakiś ŻYWY plik go importuje — ZATRZYMAJ i zgłoś (nie usuwaj).

- [ ] **Step 2: Usuń plik**

```bash
git rm components/hr/modals/EmployeeEditModal.tsx
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` → 0. `npm run build` → sukces (potwierdza brak zależności).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(hr): usun martwy EmployeeEditModal (0 zywych importow)"
```

---

### Task 7: Dokumentacja + finalna weryfikacja

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Notka w CLAUDE.md**

W sekcji o kartotece/IBAN dopisz: „IBAN pracownika walidowany mod-97 i normalizowany (`lib/iban`: `isValidIBAN`+`normalizeIBAN`; 26-cyfrowy NRB → `PL…`) we wszystkich ścieżkach (finance, bulk-import, parsery Excel, edycja inline). Każdy nowy IBAN → `iban_verified=false`."

- [ ] **Step 2: Pełny test + typecheck + build**

Run: `npx vitest run` → wszystko zielone. `npx tsc --noEmit` → 0. `npm run build` → sukces.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: utwardzenie IBAN w kartotece (SP2)"
```

---

## Self-Review

- **Spec coverage:** SP2 z roadmapy = mod-97 na serwerze [Task 2], walidacja importu Excel [Task 4], spójne `iban_verified` [Task 2/3], usunięcie martwego `EmployeeEditModal` [Task 6], wspólny walidator [Task 1/5]. Dodatkowo normalizacja NRB→PL [Task 1] — konieczna, bo `isValidIBAN` wymaga kodu kraju (Polacy wpisują 26 cyfr). Pokryte.
- **Placeholder scan:** brak — każdy krok ma konkretny kod/komendę.
- **Type consistency:** `normalizeIBAN`/`isValidIBAN` z Task 1 używane w Task 2–5; sygnatury zgodne.
- **Uwaga:** `validatePLIBAN` w `services/payrollService.ts` zostaje — używany wyłącznie przez martwe komponenty (`EmployeeImportModal`, i usuwany `EmployeeEditModal`); jego pełna konsolidacja to osobne sprzątanie poza SP2 (YAGNI).
