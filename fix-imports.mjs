import fs from 'fs';
const file = 'views/DashboardEmployee.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Remove from motion/react
const wrongImports = ['Plane, ', 'Compass, ', 'Utensils, ', 'Baby, ', 'Landmark, ', 'UserCheck, ', 'TrendingUp, ', 'ShoppingCart, '];
wrongImports.forEach(i => {
  txt = txt.replace(i, '');
});

// Add to lucide-react if not present
if (!txt.includes('Plane, Compass')) {
  txt = txt.replace(
    "} from 'lucide-react'",
    ", Plane, Compass, Utensils, Baby, Landmark, UserCheck, TrendingUp, ShoppingCart } from 'lucide-react'"
  );
}

fs.writeFileSync(file, txt, 'utf8');