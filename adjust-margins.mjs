import fs from 'fs';
const file = 'views/DashboardEmployee.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Replace the top one, make margins much smaller, uppercase KATALOG USŁUG
const initialTopStr = `        <div id="catalog-anchor" className="flex items-center gap-4 py-8 w-full select-none">
          <div className="h-px flex-1 bg-white/20" />
          <span className="text-sm font-bold text-white/50 uppercase tracking-widest">Katalog Usług</span>
          <div className="h-px flex-1 bg-white/20" />
        </div>`;

const newTopStr = `        <div id="catalog-anchor" className="flex items-center gap-4 py-1 -mt-4 -mb-4 w-full select-none">
          <div className="h-px flex-1 bg-white/20" />
          <span className="text-sm font-bold text-white/40 uppercase tracking-widest">KATALOG USŁUG</span>
          <div className="h-px flex-1 bg-white/20" />
        </div>`;

txt = txt.replace(initialTopStr, newTopStr);

// Remove the old duplicate one
const oldDuplicate = `              <div id="catalog-anchor" className="flex items-center gap-4 py-4">
                <div className="h-px flex-1 bg-white/20" />
                <span className="text-sm font-bold text-white/40 uppercase tracking-widest">Katalog Uslug</span>
                <div className="h-px flex-1 bg-white/20" />
              </div>`;

txt = txt.replace(oldDuplicate, '');

fs.writeFileSync(file, txt, 'utf8');