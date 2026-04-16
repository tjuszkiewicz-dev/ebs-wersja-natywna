// Targeted repair for AdminVouchery.tsx C5-based Polish chars
// (ł, ś, ż, ź) that were broken by wrong cp1250 table in first pass.
// They now appear as U+0139 (Ĺ) + U+FFFD in the file.
// We fix them by matching their ASCII context.
import { readFileSync, writeFileSync } from 'fs';

const file = 'components/adminNew/AdminVouchery.tsx';
let c = readFileSync(file, 'utf8');

const B = '\u0139\ufffd'; // broken token = formerly any C5-based Polish char

const fixes = [
  // STATUS_LABELS
  ["'Wygas" + B + "y'",           "'Wygas\u0142y'"],       // Wygasły
  ["'Zu" + B + "yty'",            "'Zu\u017cyty'"],         // Zużyty
  // JSX: employee placeholder
  ["u" + B + "ytkownik",          "u\u017cytkownik"],        // użytkownik
  // table header Wartość (ć already fixed to \u0107)
  ["'Warto" + B + "\u0107'",      "'Warto\u015b\u0107'"],   // Wartość
  // table header Ważny do
  ["'Wa" + B + "ny do'",          "'Wa\u017cny do'"],        // Ważny do
  // Odśwież button (two broken chars: ś + ż)
  ["Od" + B + "wie" + B,          "Od\u015bwie\u017c"],      // Odśwież
  // empty state help text
  ["U" + B + "yj panelu",         "U\u017cyj panelu"],        // Użyj
  ["powy" + B + "ej",             "powy\u017cej"],            // powyżej
  // error messages
  ["B" + B + "\u0105d emisji",    "B\u0142\u0105d emisji"],  // Błąd emisji
  ["B" + B + "\u0105d pobierania","B\u0142\u0105d pobierania"], // Błąd pobierania
];

let count = 0;
for (const [from, to] of fixes) {
  const n = c.split(from).length - 1;
  if (n > 0) {
    c = c.split(from).join(to);
    count += n;
    console.log('Fixed ' + n + 'x: ' + to.slice(0, 35));
  }
}

const remaining = (c.match(new RegExp('\u0139\ufffd', 'g')) || []).length;
if (remaining > 0) console.log('Remaining broken (in comments, OK):', remaining);

writeFileSync(file, c, 'utf8');
console.log('Total replacements:', count);
