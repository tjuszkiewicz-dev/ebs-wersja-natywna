// cleanup-test-data.mjs
// Usuwa pracownikow i zamowienia, zachowuje konta HR/superadmin i strukture bazy.
// Wymaga jednorazowego wgrania: supabase/migrations/011_dev_cleanup_proc.sql

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();
const svc = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1]?.trim();

if (!url || !svc) {
  console.error("Brak zmiennych NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, svc, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== CZYSZCZENIE DANYCH TESTOWYCH ===\n");

// 1. Wywolaj funkcje DB ktora robi TRUNCATE (omija trigger immutability)
process.stdout.write("� Wywo�uj� dev_cleanup_all()... ");
const { data: cleanupResult, error: rpcError } = await supabase.rpc("dev_cleanup_all");

if (rpcError) {
  console.error("\n\n? B��d RPC dev_cleanup_all:", rpcError.message);
  if (rpcError.message.includes("Could not find") || rpcError.message.includes("PGRST202")) {
    console.error("\n?? Funkcja nie istnieje. Wklej RAZ w Supabase SQL Editor:");
    console.error("   https://supabase.com/dashboard/project/ramedybmybcpqvelsmxd/sql/new");
    console.error("   Plik: supabase/migrations/011_dev_cleanup_proc.sql\n");
  }
  process.exit(1);
}
console.log("OK");
console.log("  Wyczyszczone: zamowienia, vouchery, transakcje, prowizje, pracownicy");

// 1b. Wyczyść financial_documents
process.stdout.write("🗑 Czyszczę financial_documents... ");
const { error: fdErr } = await supabase.from('financial_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
if (fdErr) console.warn('WARN:', fdErr.message);
else console.log("OK");

// 2. Usun ghost konta auth.users pracownikow
const employeeIds = cleanupResult?.employee_ids ?? [];
if (employeeIds.length > 0) {
  process.stdout.write(`� Usuwam ${employeeIds.length} kont auth.users pracownikow... `);
  let deleted = 0;
  for (const id of employeeIds) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (!error) deleted++;
  }
  console.log(`${deleted}/${employeeIds.length} usunietych`);
} else {
  console.log("� Brak kont auth.users pracownikow do usuniecia");
}

// 3. Weryfikacja
console.log("\n=== WERYFIKACJA ===");
const [profiles, orders, vouchers, accounts, transactions] = await Promise.all([
  supabase.from("user_profiles").select("id, role"),
  supabase.from("voucher_orders").select("id", { count: "exact", head: true }),
  supabase.from("vouchers").select("id", { count: "exact", head: true }),
  supabase.from("voucher_accounts").select("user_id", { count: "exact", head: true }),
  supabase.from("voucher_transactions").select("id", { count: "exact", head: true }),
]);

const roleCount = {};
for (const p of profiles.data ?? []) roleCount[p.role] = (roleCount[p.role] ?? 0) + 1;

console.log(`  user_profiles:        ${JSON.stringify(roleCount)}`);
console.log(`  voucher_orders:       ${orders.count ?? 0}`);
console.log(`  vouchers:             ${vouchers.count ?? 0}`);
console.log(`  voucher_accounts:     ${accounts.count ?? 0}`);
console.log(`  voucher_transactions: ${transactions.count ?? 0}`);
console.log("\n? Gotowe! Mozesz zlozyc nowe zamowienie i przetestowac przydzial voucherow.");
