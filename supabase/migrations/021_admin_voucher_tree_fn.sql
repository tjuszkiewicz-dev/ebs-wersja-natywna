-- Migration 021: Admin voucher tree functions
-- ─────────────────────────────────────────────────────────────────────────────
-- Fixes Supabase PostgREST default 1000-row limit by using SECURITY DEFINER
-- aggregate functions — RPC calls bypass the max_rows constraint entirely.
--
-- Functions:
--   1. admin_voucher_tree()                     — aggregated company→employee tree
--   2. get_employee_vouchers(user, company)      — individual voucher records (lazy)
--   3. get_employee_voucher_history(user)         — distribution history per employee
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. admin_voucher_tree()
-- Returns JSONB with companies + per-employee aggregates.
-- No PostgREST row limit applies — SECURITY DEFINER bypasses it.
-- Fields per company: id, name, nip, total, pool, pending, employees[]
-- Fields per employee: id, full_name, role, total, active, consumed, expired
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_voucher_tree()
RETURNS JSONB
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_data ORDER BY row_data->>'name')
  INTO   v_result
  FROM (
    SELECT jsonb_build_object(
      'id',       c.id,
      'name',     c.name,
      'nip',      COALESCE(c.nip, ''),

      -- Total active (not consumed / buyback_complete / expired)
      'total', (
        SELECT COUNT(*)
        FROM   vouchers v
        WHERE  v.company_id = c.id
          AND  v.status NOT IN ('consumed', 'buyback_complete', 'expired')
      ),

      -- Pool: vouchers still owned by HR / admin (not yet distributed to employees)
      'pool', (
        SELECT COUNT(*)
        FROM   vouchers v
        JOIN   user_profiles hr ON hr.id = v.current_owner_id
        WHERE  v.company_id = c.id
          AND  v.status IN ('active', 'created')
          AND  hr.role != 'pracownik'
      ),

      -- Poczekalni: sum of vouchers in pending/approved (unpaid) orders
      'pending', (
        SELECT COALESCE(SUM(o.amount_vouchers), 0)
        FROM   voucher_orders o
        WHERE  o.company_id = c.id
          AND  o.status IN ('pending', 'approved')
      ),

      -- Per-employee aggregates (only pracownik, only those who have vouchers)
      'employees', (
        SELECT jsonb_agg(e_row ORDER BY e_row->>'full_name')
        FROM (
          SELECT jsonb_build_object(
            'id',       up.id,
            'full_name', COALESCE(up.full_name, ''),
            'role',      up.role,
            'total',     COUNT(v2.id),
            'active',    COUNT(v2.id) FILTER (WHERE v2.status IN ('active', 'distributed')),
            'consumed',  COUNT(v2.id) FILTER (WHERE v2.status = 'consumed'),
            'expired',   COUNT(v2.id) FILTER (WHERE v2.status IN ('expired', 'buyback_complete'))
          ) AS e_row
          FROM   vouchers v2
          JOIN   user_profiles up ON up.id = v2.current_owner_id
          WHERE  v2.company_id = c.id
            AND  up.role = 'pracownik'
          GROUP BY up.id, up.full_name, up.role
          HAVING COUNT(v2.id) > 0
        ) t
      )

    ) AS row_data
    FROM companies c
    WHERE (
      EXISTS (SELECT 1 FROM vouchers       v WHERE v.company_id = c.id)
      OR
      EXISTS (SELECT 1 FROM voucher_orders o WHERE o.company_id = c.id AND o.status IN ('pending', 'approved'))
    )
  ) t2;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION admin_voucher_tree IS
  'Zwraca zagregowane drzewo firma→pracownik bez limitu 1000 wierszy PostgREST. '
  'Nie zawiera indywidualnych rekordów voucherów — ładuj je oddzielnie przez get_employee_vouchers(). '
  'Pola firmy: total (aktywne), pool (w puli HR), pending (w poczekalni / nieopłacone zamówienia).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_employee_vouchers(p_user_id, p_company_id)
-- Returns JSONB array of individual voucher records for one employee.
-- Called lazily when admin expands an employee row.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_employee_vouchers(
  p_user_id    UUID,
  p_company_id UUID
)
RETURNS JSONB
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',                   v.id,
        'serial_number',        v.serial_number,
        'face_value_pln',       v.face_value_pln,
        'status',               v.status,
        'issued_at',            v.issued_at,
        'valid_until',          v.valid_until,
        'redeemed_at',          v.redeemed_at,
        'buyback_agreement_id', v.buyback_agreement_id
      ) ORDER BY v.issued_at DESC
    )
    FROM vouchers v
    WHERE v.current_owner_id = p_user_id
      AND v.company_id       = p_company_id
  ), '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION get_employee_vouchers IS
  'Zwraca listę voucherów pracownika dla danej firmy. '
  'Wywoływana lazy — dopiero po kliknięciu rozwinięcia wiersza pracownika w panelu admina.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. get_employee_voucher_history(p_user_id)
-- Returns JSONB array of all distribution batches for one employee.
-- Source: distribution_batch_items JOIN distribution_batches.
-- Enables per-employee monthly voucher allocation statement.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_employee_voucher_history(p_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'batch_id',       db.id,
        'order_id',       db.order_id,
        'company_id',     db.company_id,
        'amount',         dbi.amount,
        'distributed_at', TO_CHAR(db.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'hr_name',        db.hr_name
      ) ORDER BY db.created_at DESC
    )
    FROM distribution_batch_items dbi
    JOIN distribution_batches db ON db.id = dbi.batch_id
    WHERE dbi.user_id = p_user_id
  ), '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION get_employee_voucher_history IS
  'Zwraca pełną historię przydziałów voucherów dla pracownika z distribution_batch_items. '
  'Podstawa do generowania wyciągów miesięcznych i historii zamówień per-pracownik.';

-- Grant to service_role (used by Next.js server-side)
GRANT EXECUTE ON FUNCTION admin_voucher_tree()                TO service_role;
GRANT EXECUTE ON FUNCTION get_employee_vouchers(UUID, UUID)   TO service_role;
GRANT EXECUTE ON FUNCTION get_employee_voucher_history(UUID)  TO service_role;
