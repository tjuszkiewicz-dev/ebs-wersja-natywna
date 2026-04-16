import { readFileSync, writeFileSync } from 'fs';

const file = 'views/DashboardEmployee.tsx';
let c = readFileSync(file, 'utf8');

const m = [
  ['UsĹ\x82ug', 'Usług'],
  ['ZarzÄ\x85dzane', 'Zarządzane'],
  ['dostÄ\x99p', 'dostęp'],
  ['specjalistĂ\xB3w', 'specjalistów'],
  ['caĹ\x82Ä\x85', 'całą'],
  ['dobÄ\x99', 'dobę'],
  ['ĹĽycie', 'życie'],
  ['ĹĽyciu', 'życiu'],
  ['Ĺ\xBBycie', 'Życie'],
  ['Ĺ\xBByciu', 'Życiu'],
  ['menedĹĽerĂ\xB3w', 'menedżerów'],
  ['zdarzeĹ\x84', 'zdarzeń'],
  ['badaĹ\x84', 'badań'],
  ['BadaĹ\x84', 'Badań'],
  ['przeglÄ\x85dowy', 'przeglądowy'],
  ['pomyĹ\x82kami', 'pomyłkami'],
  ['codzieĹ\x84', 'codzień'],
  ['korzyĹ\x9Bciami', 'korzyściami'],
  ['â\x80\xA2', '•'],
  ['â\x80\x93', '–'],
  ['â\x80\x94', '—'],
  ['odzyskaÄ\x87', 'odzyskać'],
  ['spokĂ\xB3j', 'spokój'],
  ['odpornoĹ\x9Bci', 'odporności'],
  ['asertywnoĹ\x9Bci', 'asertywności'],
  ['mĂ\xB3wiÄ\x87', 'mówić'],
  ['wyrzutĂ\xB3w', 'wyrzutów'],
  ['samotnoĹ\x9BÄ\x87', 'samotność'],
  ['budowaÄ\x87', 'budować'],
  ['ostroĹĽnych', 'ostrożnych'],
  ['wiÄ\x99cej', 'więcej'],
  ['siÄ\x99', 'się'],
  ['daÄ\x87', 'dać'],
  ['zmanipulowaÄ\x87', 'zmanipulować'],
  ['podwyĹĽki', 'podwyżki'],
  ['wewnÄ\x85trz', 'wewnątrz'],
  ['byÄ\x87', 'być'],
  ['bÄ\x99dÄ\x85c', 'będąc'],
  ['ZrozumieÄ\x87', 'Zrozumieć'],
  ['bĂ\xB3lu', 'bólu'],
  ['gĹ\x82owy', 'głowy'],
  ['Ä\x85', 'ą'],
  ['Ä\x99', 'ę'],
  ['Ä\x87', 'ć'],
  ['Ĺ\x82', 'ł'],
  ['Ĺ\x84', 'ń'],
  ['Ă\xB3', 'ó'],
  ['Ĺ\x9B', 'ś'],
  ['Ĺ\xBC', 'ż'],
  ['Ĺ\xBB', 'Ż'],
  ['Ĺ\x9A', 'Ź'],
  ['Ĺ\xB9', 'ź'],
  ['Ä\x86', 'Ć'],
  ['Ĺ\x81', 'Ł'],
];

let fixed = 0;
for (const [from, to] of m) {
  const count = c.split(from).length - 1;
  if (count > 0) {
    c = c.split(from).join(to);
    fixed += count;
    console.log(`  ${from} → ${to} (${count}x)`);
  }
}

writeFileSync(file, c, 'utf8');
console.log(`\nZapisano. Naprawiono ${fixed} wystąpień.`);
