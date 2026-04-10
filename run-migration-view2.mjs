import fs from 'fs';

const file = 'views/DashboardEmployee.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find icons to import
const newIcons = ['ShoppingCart', 'TrendingUp', 'UserCheck', 'Landmark', 'Baby', 'Utensils', 'Compass', 'Plane'];
newIcons.forEach(icon => {
  if (!content.includes(icon) || !content.match(new RegExp(`import.*\\b${icon}\\b.*lucide-react`))) {
    content = content.replace(
      "import { ",
      `import { ${icon}, `
    );
  }
});

const sectionToInsertBefore = "      {/* Mobile: recent transactions */}";

const newSections = `      {/* Poradniki */}
      <div>
        <SectionDivider title="Poradniki" subtitle="Dowiedz się więcej" accent="#F59E0B" />
        <ServiceCarousel>
          <AppIconCard
            icon={<ShoppingCart size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&q=80&w=800"
            name="Psychologia zakupów online"
            desc="ONE-TIME • Jak nie dać się zmanipulować algorytmom."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={7}
            onClick={() => handlePartnerRequest('Poradniki', 'Psychologia zakupów online')}
          />
          <AppIconCard
            icon={<TrendingUp size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=800"
            name="Negocjacje podwyżki w 2026"
            desc="ONE-TIME • Nowoczesne argumenty oparte na danych."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={42}
            onClick={() => handlePartnerRequest('Poradniki', 'Negocjacje podwyżki w 2026')}
          />
          <AppIconCard
            icon={<UserCheck size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&q=80&w=800"
            name="Personal Branding wewnątrz firmy"
            desc="ONE-TIME • Jak być widocznym, nie będąc nachalnym."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={19}
            onClick={() => handlePartnerRequest('Poradniki', 'Personal Branding wewnątrz firmy')}
          />
          <AppIconCard
            icon={<Landmark size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1565514020176-6c2235b8b3a9?auto=format&fit=crop&q=80&w=800"
            name="Emerytura 2.0"
            desc="ONE-TIME • Zrozumieć PPK, IKE i IKZE bez bólu głowy."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={36}
            onClick={() => handlePartnerRequest('Poradniki', 'Emerytura 2.0')}
          />
        </ServiceCarousel>
      </div>

      {/* E-booki */}
      <div>
        <SectionDivider title="E-booki" subtitle="Poczytaj sobie" accent="#EC4899" />
        <ServiceCarousel>
          <AppIconCard
            icon={<Baby size={24} style={{ color: '#EC4899' }} />}
            image="https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&q=80&w=800"
            name="Bajka na dobranoc: Robot, który chciał mieć sny"
            desc="ONE-TIME • Audio dla dzieci pracowników."
            gradient="linear-gradient(135deg,#fdf2f8,#fce7f3)"
            hasAccess={false}
            price={11}
            onClick={() => handlePartnerRequest('E-booki', 'Bajka na dobranoc')}
          />
          <AppIconCard
            icon={<Utensils size={24} style={{ color: '#EC4899' }} />}
            image="https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&q=80&w=800"
            name="Kuchnia w 15 minut"
            desc="ONE-TIME • Meal-prep dla zapracowanych."
            gradient="linear-gradient(135deg,#fdf2f8,#fce7f3)"
            hasAccess={false}
            price={24}
            onClick={() => handlePartnerRequest('E-booki', 'Kuchnia w 15 minut')}
          />
          <AppIconCard
            icon={<Compass size={24} style={{ color: '#EC4899' }} />}
            image="https://images.unsplash.com/photo-1455355675860-e883e35ab3a7?auto=format&fit=crop&q=80&w=800"
            name="Hobby zamiast scrollowania"
            desc="ONE-TIME • Jak znaleźć pasję, która nie wymaga ekranu."
            gradient="linear-gradient(135deg,#fdf2f8,#fce7f3)"
            hasAccess={false}
            price={17}
            onClick={() => handlePartnerRequest('E-booki', 'Hobby zamiast scrollowania')}
          />
          <AppIconCard
            icon={<Plane size={24} style={{ color: '#EC4899' }} />}
            image="https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=800"
            name="Podróże z nielimitowanym urlopem"
            desc="ONE-TIME • Jak planować workation."
            gradient="linear-gradient(135deg,#fdf2f8,#fce7f3)"
            hasAccess={false}
            price={48}
            onClick={() => handlePartnerRequest('E-booki', 'Podróże z nielimitowanym urlopem')}
          />
          <AppIconCard
            icon={<Users size={24} style={{ color: '#EC4899' }} />}
            image="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=800"
            name="Komunikacja między pokoleniami"
            desc="ONE-TIME • Jak dogadać się z Gen Z i Boomerami."
            gradient="linear-gradient(135deg,#fdf2f8,#fce7f3)"
            hasAccess={false}
            price={39}
            onClick={() => handlePartnerRequest('E-booki', 'Komunikacja między pokoleniami')}
          />
        </ServiceCarousel>
      </div>

`;

if (content.includes(sectionToInsertBefore)) {
  content = content.replace(sectionToInsertBefore, newSections + sectionToInsertBefore);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Migration 2 successful");
} else {
  console.log("Could not find section to insert before");
}
