-- E5: status pracy + TLC (karta pobytu z innego kraju)
-- work_status jest ŚWIADOMIE ODDZIELNY od hr_employees.status (active/inactive).
-- status  -> steruje rozliczeniami, payrollem, filtrem alertów
-- work_status -> wyłącznie prezentacja (kropki, liczniki, plakietki)

ALTER TABLE public.hr_employees
  ADD COLUMN IF NOT EXISTS work_status text NOT NULL DEFAULT 'pracuje',
  ADD COLUMN IF NOT EXISTS tlc boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tlc_expiry date;

COMMENT ON COLUMN public.hr_employees.work_status IS
  'pracuje | oczekuje | urlop | zwolniony. Prezentacyjny. NIE mylic ze status (active/inactive).';
COMMENT ON COLUMN public.hr_employees.tlc IS
  'Karta pobytu wydana przez inny kraj UE.';

-- Backfill: tylko rekordy, ktore nadal maja wartosc domyslna po dodaniu kolumny.
-- Idempotentny - powtorne uruchomienie nie nadpisze recznych zmian operatora,
-- bo po pierwszym przebiegu archiwalni maja juz 'zwolniony'.
UPDATE public.hr_employees
   SET work_status = 'zwolniony'
 WHERE archived = true AND work_status = 'pracuje';

UPDATE public.hr_employees
   SET work_status = 'oczekuje'
 WHERE archived = false AND status <> 'active' AND work_status = 'pracuje';

CREATE INDEX IF NOT EXISTS idx_hr_employees_work_status
  ON public.hr_employees (work_status) WHERE archived = false;
