import fs from 'fs';

const file = 'views/DashboardEmployee.tsx';
let content = fs.readFileSync(file, 'utf8');

// Insert import 
if (!content.includes('ServiceCarousel')) {
  content = content.replace(
    "import { SectionDivider, AppIconCard, FloatingTabBar } from '../components/employee/dashboard/EmployeeWidgets';",
    "import { SectionDivider, AppIconCard, FloatingTabBar } from '../components/employee/dashboard/EmployeeWidgets';\nimport { ServiceCarousel } from '../components/ui/ServiceCarousel';"
  );
}

// Find icons to import that might be missing
const newIcons = ['Smartphone', 'Heart', 'MessageSquare', 'Moon', 'Users'];
newIcons.forEach(icon => {
  if (!content.includes(icon) || !content.match(new RegExp(`import.*\\b${icon}\\b.*lucide-react`))) {
    content = content.replace(
      "import { ",
      `import { ${icon}, `
    );
  }
});

// Replace the sections
const oldSectionStart = "      {/* Twoje Aplikacje */}";
const oldSectionEnd = "      {/* Mobile: recent transactions */}";

if (content.includes(oldSectionStart) && content.includes(oldSectionEnd)) {
  const startIndex = content.indexOf(oldSectionStart);
  const endIndex = content.indexOf(oldSectionEnd);

const replacement = `      {/* Twoje Aplikacje */}
      <div>
        <SectionDivider title="Twoje Aplikacje" subtitle="Zarządzane przez Eliton" accent="#7C3AED" />
        <ServiceCarousel>
          <AppIconCard
            icon={<Brain size={24} style={{ color: '#7C3AED' }} />}
            image="/coach.png"
            name="Wellbeing"
            desc="AI Coach, medytacje i sesje deep work."
            gradient="linear-gradient(135deg,#f5f3ff,#ede9fe)"
            hasAccess={hasMentalHealthAccess}
            price={100}
            onClick={() => hasMentalHealthAccess ? setActiveTab('WELLBEING') : wellbeingService && setSelectedService(wellbeingService)}
          />
          <AppIconCard
            icon={<Scale size={24} style={{ color: '#b45309' }} />}
            image="/prawnik.png"
            name="AI Prawnik"
            desc="Analiza umów i porady prawne 24/7."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={hasLegalAccess}
            price={150}
            onClick={() => hasLegalAccess ? setActiveTab('LEGAL') : legalService && setSelectedService(legalService)}
          />
          <AppIconCard
            icon={<Lock size={24} style={{ color: '#16a34a' }} />}
            image="/klodka.png"
            name="Secure Messenger"
            desc="Szyfrowana komunikacja end-to-end."
            gradient="linear-gradient(135deg,#f0fdf4,#dcfce7)"
            hasAccess={hasSecureMessengerAccess}
            price={200}
            onClick={() => hasSecureMessengerAccess ? setActiveTab('SECURE_MESSENGER') : setSelectedService(secureMessengerService)}
          />
          <AppIconCard
            icon={<ShieldCheck size={24} style={{ color: '#2563EB' }} />}
            image="/sejf.png"
            name="Digital Vault"
            desc="Prywatny sejf cyfrowy 10 GB. AES-256."
            gradient="linear-gradient(135deg,#eff6ff,#dbeafe)"
            hasAccess={hasVaultAccess}
            price={50}
            onClick={() => hasVaultAccess ? setActiveTab('DIGITAL_VAULT') : setSelectedService(vaultService)}
          />
        </ServiceCarousel>
      </div>

      {/* Profitowi – Ubezpieczenia i Zdrowie */}
      <div>
        <SectionDivider title="Profitowi" subtitle="Ubezpieczenia i Zdrowie" accent="#10B981" />
        <ServiceCarousel>
          <AppIconCard
            icon={<ShieldCheck size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&q=80&w=800"
            name="Luxmed"
            desc="Pakiet Optyka i Rehabilitacja. Szybki dostęp do specjalistów."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Luxmed (Profitowi)', 'Pakiet Optyka i Rehabilitacja')}
          />
          <AppIconCard
            icon={<ShieldCheck size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&q=80&w=800"
            name="PZU"
            desc="Ubezpieczenie NNW Pracownicze. Ochrona całą dobę."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('PZU (Profitowi)', 'Ubezpieczenie NNW Pracownicze')}
          />
          <AppIconCard
            icon={<ShieldCheck size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&q=80&w=800"
            name="Uniga"
            desc="Szerokie ubezpieczenie na życie dla rodziny."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Uniga (Profitowi)', 'Ubezpieczenie na Życie')}
          />
          <AppIconCard
            icon={<ShieldCheck size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1522204538344-922f76ecc041?auto=format&fit=crop&q=80&w=800"
            name="Loyds"
            desc="Ubezpieczenie od utraty dochodu dla menedżerów."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Loyds (Profitowi)', 'Ubezpieczenie od Utraty Dochodu')}
          />
        </ServiceCarousel>
      </div>

      {/* Multipolisa.pl – Ubezpieczenia i zdrowie */}
      <div>
        <SectionDivider title="Multipolisa.pl" subtitle="Ubezpieczenia i zdrowie" accent="#F59E0B" />
        <ServiceCarousel>
          <AppIconCard
            icon={<Shield size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800"
            name="Ergo Hestia"
            desc="Pakiet Bezpieczny Dom od wszelkich zdarzeń."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Ergo Hestia (Multipolisa)', 'Pakiet Bezpieczny Dom')}
          />
          <AppIconCard
            icon={<Shield size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800"
            name="Warta"
            desc="Ubezpieczenie turystyczne na delegacje i wakacje."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Warta (Multipolisa)', 'Ubezpieczenie Turystyczne')}
          />
          <AppIconCard
            icon={<Shield size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=800"
            name="TU Zdrowie"
            desc="Pakiet podstawowych badań i przeglądowy dla aktywnych."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('TU Zdrowie (Multipolisa)', 'Pakiet Badań Profilaktycznych')}
          />
          <AppIconCard
            icon={<Shield size={24} style={{ color: '#F59E0B' }} />}
            image="https://images.unsplash.com/photo-1542382121-e9de4599fb4b?auto=format&fit=crop&q=80&w=800"
            name="Leadenhall"
            desc="OC w życiu prywatnym, chroni przed pomyłkami na codzień."
            gradient="linear-gradient(135deg,#fffbeb,#fef3c7)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Leadenhall (Multipolisa)', 'Ubezpieczenie OC w Życiu Prywatnym')}
          />
        </ServiceCarousel>
      </div>

      {/* Goldman Sachs */}
      <div>
        <SectionDivider title="Goldman Sachs" subtitle="Fundusze inwestycyjne" accent="#3B82F6" />
        <ServiceCarousel>
          <AppIconCard
            icon={<span className="font-serif font-bold text-[#1e3a8a] text-[10px] whitespace-nowrap leading-none text-center">Goldman<br/>Sachs</span>}
            image="https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&q=80&w=800"
            name="IKE"
            desc="Indywidualne Konto Emerytalne z korzyściami podatkowymi."
            gradient="linear-gradient(135deg,#eff6ff,#dbeafe)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Goldman Sachs', 'IKE')}
          />
          <AppIconCard
            icon={<span className="font-serif font-bold text-[#1e3a8a] text-[10px] whitespace-nowrap leading-none text-center">Goldman<br/>Sachs</span>}
            image="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=800"
            name="IKZE"
            desc="Indywidualne Konto Zabezpieczenia Emerytalnego."
            gradient="linear-gradient(135deg,#eff6ff,#dbeafe)"
            hasAccess={false}
            price={0}
            onClick={() => handlePartnerRequest('Goldman Sachs', 'IKZE')}
          />
          <AppIconCard
            icon={<span className="font-serif font-bold text-[#1e3a8a] text-[10px] whitespace-nowrap leading-none text-center">Goldman<br/>Sachs</span>}
            image=""
            name="Wolne miejsce"
            desc="Wkrótce nowy produkt inwestycyjny."
            gradient="linear-gradient(135deg,#eff6ff,#dbeafe)"
            hasAccess={false}
            price={0}
            onClick={() => {}}
          />
          <AppIconCard
            icon={<span className="font-serif font-bold text-[#1e3a8a] text-[10px] whitespace-nowrap leading-none text-center">Goldman<br/>Sachs</span>}
            image=""
            name="Wolne miejsce"
            desc="Wkrótce nowy produkt inwestycyjny."
            gradient="linear-gradient(135deg,#eff6ff,#dbeafe)"
            hasAccess={false}
            price={0}
            onClick={() => {}}
          />
        </ServiceCarousel>
      </div>

      {/* Wellbeing */}
      <div>
        <SectionDivider title="Wellbeing" subtitle="Jednorazowe produkty" accent="#10B981" />
        <ServiceCarousel>
          <AppIconCard
            icon={<Smartphone size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?auto=format&fit=crop&q=80&w=800"
            name="Cyfrowy detoks w 15 minut"
            desc="ONE-TIME • Jak odzyskać spokój bez wyrzucania telefonu."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={9}
            onClick={() => handlePartnerRequest('Wellbeing', 'Cyfrowy detoks w 15 minut')}
          />
          <AppIconCard
            icon={<Heart size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1522204538344-922f76ecc041?auto=format&fit=crop&q=80&w=800"
            name="Trening odporności (Resilience)"
            desc="ONE-TIME • Techniki jednostek specjalnych dla korporacji."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={33}
            onClick={() => handlePartnerRequest('Wellbeing', 'Trening odporności na stres')}
          />
          <AppIconCard
            icon={<MessageSquare size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1573497620053-ea5300f94f21?auto=format&fit=crop&q=80&w=800"
            name="Sztuka asertywności na Teamsach"
            desc="ONE-TIME • Jak mówić nie, bez wyrzutów sumienia."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={21}
            onClick={() => handlePartnerRequest('Wellbeing', 'Sztuka asertywności na Teamsach')}
          />
          <AppIconCard
            icon={<Moon size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1511296933631-18b46797e652?auto=format&fit=crop&q=80&w=800"
            name="Sen jako Twój najlepszy projekt"
            desc="ONE-TIME • Biohacking nocnej regeneracji."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={44}
            onClick={() => handlePartnerRequest('Wellbeing', 'Sen jako Twój najlepszy projekt')}
          />
          <AppIconCard
            icon={<Users size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1593642532973-d31b6557fa68?auto=format&fit=crop&q=80&w=800"
            name="Praca z domu i samotność"
            desc="ONE-TIME • Jak budować relacje w trybie remote."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={15}
            onClick={() => handlePartnerRequest('Wellbeing', 'Praca z domu i samotność')}
          />
          <AppIconCard
            icon={<Shield size={24} style={{ color: '#10B981' }} />}
            image="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=800"
            name="Inwestowanie dla ostrożnych"
            desc="ONE-TIME • Podstawy budowania poduszki."
            gradient="linear-gradient(135deg,#ecfdf5,#d1fae5)"
            hasAccess={false}
            price={28}
            onClick={() => handlePartnerRequest('Wellbeing', 'Inwestowanie dla ostrożnych')}
          />
        </ServiceCarousel>
      </div>

`;

  const newContent = content.slice(0, startIndex) + replacement + "\n" + content.slice(endIndex);
  fs.writeFileSync(file, newContent, 'utf8');
  console.log("Migration successful");
} else {
  console.log("Could not find delimiters :(");
}
