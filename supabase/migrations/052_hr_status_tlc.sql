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

-- Backfill: jednorazowy, strazony. Warunek WHERE work_status = 'pracuje' sam w sobie
-- NIE gwarantuje jednorazowosci (to tylko "ma wartosc domyslna", nie "nigdy nie byl
-- backfillowany") - operator moze recznie ustawic komus 'pracuje' i replay migracji
-- (nowa galaz Supabase, reset staging) po cichu by to nadpisal. Dlatego caly backfill
-- jest owiniety w straznika: leci TYLKO gdy zaden wiersz nie ma jeszcze statusu innego
-- niz domyslny (czyli backfill na pewno jeszcze sie nie odbyl).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.hr_employees WHERE work_status <> 'pracuje') THEN
    UPDATE public.hr_employees
       SET work_status = 'zwolniony'
     WHERE archived = true AND work_status = 'pracuje';

    UPDATE public.hr_employees
       SET work_status = 'oczekuje'
     WHERE archived = false AND status <> 'active' AND work_status = 'pracuje';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hr_employees_work_status
  ON public.hr_employees (work_status) WHERE archived = false;
