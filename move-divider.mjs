import fs from 'fs';
const file = 'views/DashboardEmployee.tsx';
let txt = fs.readFileSync(file, 'utf8');

const regex = /<div id="catalog-anchor"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g;
// The div ends after the inner span and two inner divs.
// Let's use string replace.

const searchString = `              <div id="catalog-anchor" className="flex items-center gap-4 py-4">
                <div className="h-px flex-1 bg-white/20" />
                <span className="text-sm font-bold text-white/40 uppercase tracking-widest">Katalog Uslug</span>
                <div className="h-px flex-1 bg-white/20" />
              </div>`;

txt = txt.replace(searchString, '');

const insertTarget = "      {/* Twoje Aplikacje */}";
const newStr = `      <div id="catalog-anchor" className="flex items-center gap-4 py-8 w-full select-none">
        <div className="h-px flex-1 bg-white/20" />
        <span className="text-sm font-bold text-white/50 uppercase tracking-widest">Katalog Usług</span>
        <div className="h-px flex-1 bg-white/20" />
      </div>

      {/* Twoje Aplikacje */}`;

txt = txt.replace(insertTarget, newStr);
fs.writeFileSync(file, txt, 'utf8');