
import { Company, Role, User, Voucher, VoucherStatus, Order, OrderStatus, AuditLogEntry, Commission, Notification, NotificationConfig, NotificationTarget, NotificationTrigger, ServiceItem, ServiceType, Transaction, SystemConfig, DocumentType, ContractType, SupportTicket } from '../types';

// Struktura Sprzedaży
const ADVISOR_ID = 'ADV-001';
const MANAGER_ID = 'MAN-001';
const DIRECTOR_ID = 'DIR-001';

const BUYBACK_TEMPLATE_CONTENT = `UMOWA ODKUPU VOUCHERÓW NR: {AGREEMENT_ID}

Zawarta w dniu {DATE} pomiędzy:

1. STRATTON PRIME S.A. z siedzibą w Warszawie (Właściciel Platformy Eliton), zwanym dalej "Operatorem",
a
2. {USER_NAME} (ID Systemowe: {USER_ID}), zwanym dalej "Użytkownikiem".

§1 PRZEDMIOT UMOWY
1. Użytkownik oświadcza, że posiada {VOUCHER_COUNT} sztuk Voucherów Prime, które uległy przeterminowaniu lub rezygnacji, o łącznej wartości nominalnej {TOTAL_VALUE} PLN.
2. Operator zobowiązuje się do odkupu wyżej wymienionych Voucherów za kwotę {TOTAL_VALUE} PLN (słownie: {TOTAL_VALUE} złotych 00/100).

§2 WARUNKI PŁATNOŚCI
1. Płatność nastąpi w formie uznania salda technicznego lub przelewu na rachunek bankowy powiązany z kontem Użytkownika w Systemie EBS w terminie 7 dni.
2. Z chwilą zatwierdzenia niniejszej umowy Vouchery zostają trwale wycofane z obiegu (anulowane) i nie mogą być wykorzystane do zakupu usług.

§3 POSTANOWIENIA KOŃCOWE
1. Umowa została wygenerowana elektronicznie w systemie Eliton Benefits System (EBS) i nie wymaga odręcznego podpisu.
2. Data wygenerowania dokumentu jest datą skutecznego zawarcia umowy pod warunkiem jej zatwierdzenia przez Operatora.

PODPISANO:
Operator: System Eliton (w im. Stratton Prime)
Użytkownik: {USER_NAME} (Akceptacja Elektroniczna)`;

export const INITIAL_SYSTEM_CONFIG: SystemConfig = {
  // Global
  defaultVoucherValidityDays: 7,
  paymentTermsDays: 7,
  platformCurrency: 'PLN',
  
  // Security
  minPasswordLength: 8,
  sessionTimeoutMinutes: 30,
  auditLogRetentionDays: 365,
  
  // Print
  pdfAutoScaling: true,

  // Documents
  buybackAgreementTemplate: BUYBACK_TEMPLATE_CONTENT,
  templates: [
    {
        id: 'TPL-001',
        name: 'Standardowa Umowa Odkupu',
        type: DocumentType.AGREEMENT,
        content: BUYBACK_TEMPLATE_CONTENT,
        version: 1,
        lastModified: new Date().toISOString(),
        accessRoles: [Role.SUPERADMIN, Role.EMPLOYEE],
        description: 'Domyślny wzór umowy generowanej przy wygasaniu voucherów.',
        isSystem: true
    },
    {
        id: 'TPL-002',
        name: 'Regulamin Platformy 2025',
        type: DocumentType.POLICY,
        content: `REGULAMIN SYSTEMU BENEFITOWEGO ELITON (EBS)\n\n§1 Postanowienia Ogólne\n1. Operatorem systemu jest Stratton Prime S.A.\n2. Użytkownik zobowiązany jest do...`,
        version: 2,
        lastModified: new Date().toISOString(),
        accessRoles: [Role.SUPERADMIN, Role.HR, Role.EMPLOYEE],
        description: 'Ogólne warunki korzystania z platformy.',
        isSystem: true
    },
    {
        id: 'TPL-003',
        name: 'Nota Obciążeniowa (Vouchery)',
        type: DocumentType.INVOICE,
        content: `NOTA KSIĘGOWA NR: {DOC_ID}\n\nNabywca: {COMPANY_NAME}\nNIP: {COMPANY_NIP}\n\nTreść: Zasilenie konta punktowego.\nWartość: {TOTAL_VALUE} PLN.\nTermin: {PAYMENT_TERMS} dni.`,
        version: 1,
        lastModified: new Date().toISOString(),
        accessRoles: [Role.SUPERADMIN, Role.HR],
        description: 'Wzór noty księgowej dla HR.',
        isSystem: true
    }
  ]
};

export const INITIAL_USERS: User[] = [
  {
    id: 'ADM-001',
    role: Role.SUPERADMIN,
    name: 'System Administrator',
    email: 'admin@eliton-benefits.com',
    voucherBalance: 0,
    status: 'ACTIVE',
    identity: { firstName: 'System', lastName: 'Administrator', pesel: '', email: 'admin@eliton-benefits.com' },
    organization: { department: 'IT', position: 'Superadmin' },
    isTwoFactorEnabled: true // ENFORCE 2FA FOR ADMIN DEMO
  },
  // --- Sales Structure ---
  {
    id: ADVISOR_ID,
    role: Role.ADVISOR,
    name: 'Adam Doradca',
    email: 'adam.d@eliton-benefits.com',
    voucherBalance: 0,
    status: 'ACTIVE',
    identity: { firstName: 'Adam', lastName: 'Doradca', pesel: '', email: 'adam.d@eliton-benefits.com' },
    organization: { department: 'Sales', position: 'Advisor' }
  },
  {
    id: MANAGER_ID,
    role: Role.MANAGER,
    name: 'Marek Manager',
    email: 'marek.m@eliton-benefits.com',
    voucherBalance: 0,
    status: 'ACTIVE',
    identity: { firstName: 'Marek', lastName: 'Manager', pesel: '', email: 'marek.m@eliton-benefits.com' },
    organization: { department: 'Sales', position: 'Manager' }
  },
  {
    id: DIRECTOR_ID,
    role: Role.DIRECTOR,
    name: 'Daria Dyrektor',
    email: 'daria.d@eliton-benefits.com',
    voucherBalance: 0,
    status: 'ACTIVE',
    identity: { firstName: 'Daria', lastName: 'Dyrektor', pesel: '', email: 'daria.d@eliton-benefits.com' },
    organization: { department: 'Sales', position: 'Director' }
  },
  // --- EMPLOYEES (New EPS Structure) ---
  {
    id: 'EMP-001',
    role: Role.EMPLOYEE,
    companyId: 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
    status: 'ACTIVE',
    voucherBalance: 150,
    
    // Facade
    name: 'Jan Kowalski',
    email: 'jan.kowalski@techsolutions.pl',
    pesel: '90051209876',
    department: 'IT',
    position: 'Senior Developer',

    // EPS Layers
    identity: { 
        firstName: 'Jan', 
        lastName: 'Kowalski', 
        pesel: '90051209876', 
        email: 'jan.kowalski@techsolutions.pl' 
    },
    organization: { 
        department: 'IT', 
        position: 'Senior Developer' 
    },
    contract: {
        type: ContractType.UOP,
        hasSicknessInsurance: true
    },
    finance: {
        payoutAccount: {
            iban: 'PL12345678901234567890123456', // Fake but structurally valid
            country: 'PL',
            isVerified: true,
            verificationMethod: 'MICROTRANSFER',
            lastVerifiedAt: new Date().toISOString()
        }
    }
  },
  {
    id: 'EMP-002',
    role: Role.EMPLOYEE,
    companyId: 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
    status: 'ACTIVE',
    voucherBalance: 50,

    // Facade
    name: 'Piotr Wiśniewski',
    email: 'piotr.w@techsolutions.pl',
    pesel: '95113005432',
    department: 'Marketing',
    position: 'Junior Specialist',

    // EPS Layers
    identity: { 
        firstName: 'Piotr', 
        lastName: 'Wiśniewski', 
        pesel: '95113005432', 
        email: 'piotr.w@techsolutions.pl' 
    },
    organization: { 
        department: 'Marketing', 
        position: 'Junior Specialist' 
    },
    contract: {
        type: ContractType.UZ,
        hasSicknessInsurance: false
    },
    // Missing Finance Layer (Unverified for Buyback)
  }
];

export const INITIAL_COMPANIES: Company[] = [
  {
    id: 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
    name: 'Stratton Prime S.A.',
    nip: '521-000-00-01',
    balancePending: 0,
    balanceActive: 1000,
    advisorId: ADVISOR_ID,
    managerId: MANAGER_ID,
    directorId: DIRECTOR_ID,
    email: 'biuro@strattonprime.pl',
    phone: '+48 22 100 200 300',
    contactPersonName: 'Katarzyna Wiśniewska',
    voucherValidityDays: 7,
    address: { street: 'ul. Marszałkowska 1', city: 'Warszawa', postalCode: '00-001', country: 'Polska' },
    correspondenceAddress: { street: 'ul. Marszałkowska 1', city: 'Warszawa', postalCode: '00-001', country: 'Polska' }
  },
  {
    id: 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
    name: 'TechSolutions Sp. z o.o.',
    nip: '525-000-11-22',
    balancePending: 0,
    balanceActive: 500,
    advisorId: ADVISOR_ID,
    managerId: MANAGER_ID,
    directorId: DIRECTOR_ID,
    email: 'hr@techsolutions.pl',
    phone: '+48 12 345 678 90',
    contactPersonName: 'Anna Nowak',
    voucherValidityDays: 7,
    address: { street: 'ul. Krakowska 42', city: 'Kraków', postalCode: '30-001', country: 'Polska' },
    correspondenceAddress: { street: 'ul. Krakowska 42', city: 'Kraków', postalCode: '30-001', country: 'Polska' }
  }
];

// Generate some initial vouchers with STRICT HIERARCHICAL IDs
// Format: SP / FIRMA / ZAM / EMISJA / V-XXXXXX
const generateVouchers = (count: number, status: VoucherStatus, ownerId?: string): Voucher[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `SP/FIRMA-042/INIT-ORDER/EMISJA-01/V-${String(i + 1).padStart(6, '0')}`,
    value: 1, // 1 Voucher = 1 PLN
    status,
    companyId: 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
    orderId: 'INIT-ORDER',
    emissionId: 'EMISJA-01',
    ownerId: ownerId,
    issueDate: new Date().toISOString(),
    expiryDate: status === VoucherStatus.DISTRIBUTED 
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() 
      : undefined
  }));
};

export const INITIAL_VOUCHERS: Voucher[] = [
  ...generateVouchers(500, VoucherStatus.ACTIVE), // HR Pool (Active)
  ...generateVouchers(150, VoucherStatus.DISTRIBUTED, 'EMP-001'), // Employee 1
  ...generateVouchers(50, VoucherStatus.DISTRIBUTED, 'EMP-002'), // Employee 2
];

export const INITIAL_ORDERS: Order[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];
export const INITIAL_COMMISSIONS: Commission[] = [];
export const INITIAL_NOTIFICATIONS: Notification[] = [];

// --- UPDATED TRANSACTIONS: Pre-load some apps for EMP-001 to show them "ready" ---
export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'TRX-LEGAL-001',
    userId: 'EMP-001',
    type: 'DEBIT',
    serviceId: 'SRV-LEGAL-01',
    serviceName: 'AI Legal Assistant',
    amount: 150,
    date: new Date(Date.now() - 432000000).toISOString() // 5 days ago
  },
  {
    id: 'TRX-MENTAL-001',
    userId: 'EMP-001',
    type: 'DEBIT',
    serviceId: 'SRV-MENTAL-01',
    serviceName: 'EBS Wellbeing Premium',
    amount: 100,
    date: new Date(Date.now() - 864000000).toISOString() // 10 days ago
  }
];

// --- System Governance Config ---
export const INITIAL_NOTIFICATION_CONFIGS: NotificationConfig[] = [
  { 
    id: 'NC-01', 
    target: NotificationTarget.EMPLOYEE, 
    trigger: NotificationTrigger.VOUCHER_GRANTED,
    daysOffset: 0, 
    messageTemplate: 'Otrzymałeś {AMOUNT} voucherów. Ważne do: {EXPIRY_DATE}.', 
    isEnabled: true 
  },
  { 
    id: 'NC-02', 
    target: NotificationTarget.EMPLOYEE, 
    trigger: NotificationTrigger.VOUCHER_EXPIRING,
    daysOffset: 3, 
    messageTemplate: 'Twoje vouchery ({AMOUNT} szt.) wygasają za 3 dni.', 
    isEnabled: true 
  },
  { 
    id: 'NC-03', 
    target: NotificationTarget.HR, 
    trigger: NotificationTrigger.ORDER_UNPAID,
    daysOffset: 7, 
    messageTemplate: 'Przypomnienie o płatności za fakturę {DOC_ID}.', 
    isEnabled: true 
  }
];

export const INITIAL_SERVICES: ServiceItem[] = [
  // --- MENTAL HEALTH APP INTEGRATION ---
  { 
      id: 'SRV-MENTAL-01', 
      name: 'EBS Wellbeing Premium', 
      description: 'Miesięczny dostęp do platformy Mental Health (AI Coach, Medytacje, Wideo).', 
      price: 100, // 100 points cost
      type: ServiceType.SUBSCRIPTION, 
      icon: 'Brain', 
      image: 'https://images.unsplash.com/photo-1544367563-12123d8975bd?auto=format&fit=crop&q=80&w=800',
      isActive: true 
  },
  // --- AI LEGAL ASSISTANT INTEGRATION (NEW) ---
  { 
      id: 'SRV-LEGAL-01', 
      name: 'AI Legal Assistant', 
      description: 'Twój osobisty prawnik 24/7. Analiza umów i porady prawne.', 
      price: 150, 
      type: ServiceType.SUBSCRIPTION, 
      icon: 'Scale', 
      image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=800',
      isActive: true 
  },
  { 
      id: 'SRV-LEGAL-SINGLE', 
      name: 'Analiza Umowy (Jednorazowa)', 
      description: 'Sprawdzenie jednego dokumentu PDF pod kątem klauzul abuzywnych.', 
      price: 50, 
      type: ServiceType.ONE_TIME, 
      icon: 'FileText', 
      image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=800',
      isActive: true 
  },
  // --- OFERTA ORANGE ---
  { 
      id: 'SRV-ORANGE-FIBER', 
      name: 'Światłowód Pro 2.0', 
      description: 'Super szybki internet światłowodowy do Twojego domu.', 
      price: 59, 
      type: ServiceType.SUBSCRIPTION, 
      icon: 'Wifi', 
      image: 'https://images.unsplash.com/photo-1544197150-b99a580bbcbf?auto=format&fit=crop&q=80&w=800',
      isActive: true 
  },
  { 
      id: 'SRV-ORANGE-GSM', 
      name: 'Plan Firmowy L', 
      description: 'Nielimitowane rozmowy i SMSy, duży pakiet danych.', 
      price: 45, 
      type: ServiceType.SUBSCRIPTION, 
      icon: 'Smartphone', 
      image: 'https://images.unsplash.com/photo-1512428559087-560fa5ce7d02?auto=format&fit=crop&q=80&w=800',
      isActive: true 
  },
  { 
      id: 'SRV-ORANGE-LOVE', 
      name: 'Orange Love Mini', 
      description: 'Pakiet usług dla całej rodziny w jednej cenie.', 
      price: 89, 
      type: ServiceType.SUBSCRIPTION, 
      icon: 'Heart', 
      image: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&q=80&w=800',
      isActive: true 
  },
  // -------------------------------------
  { id: 'SRV-01', name: 'Spotify Premium (30 dni)', description: 'Dostęp do muzyki bez reklam', price: 20, type: ServiceType.SUBSCRIPTION, icon: 'Headphones', image: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-02', name: 'Audioteka (1 Audiobook)', description: 'Dowolny audiobook z oferty', price: 35, type: ServiceType.ONE_TIME, icon: 'BookOpen', image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-03', name: 'Porada Prawna Online (Człowiek)', description: 'Konsultacja z radcą prawnym (Video)', price: 200, type: ServiceType.ONE_TIME, icon: 'Scale', image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-04', name: 'Multikino (Bilet)', description: 'Bilet na dowolny seans 2D', price: 25, type: ServiceType.ONE_TIME, icon: 'Film', image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=800', isActive: true },

  // --- AI & PRODUCTIVITY ---
  { id: 'SRV-AI-01', name: 'Twój pierwszy dzień z osobistym AI', description: 'Jak delegować nudne zadania.', price: 23, type: ServiceType.ONE_TIME, icon: 'Cpu', image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-AI-02', name: 'Prompt Engineering dla nietechnicznych', description: 'Jak rozmawiać z maszyną, by Cię rozumiała.', price: 41, type: ServiceType.ONE_TIME, icon: 'Zap', image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-AI-03', name: 'Głęboka praca w świecie powiadomień', description: 'Techniki koncentracji w 2026 roku.', price: 12, type: ServiceType.ONE_TIME, icon: 'Brain', image: 'https://images.unsplash.com/photo-1506784365847-bbad939e9335?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-AI-04', name: 'Automatyzacja codzienności', description: 'Proste triki na cyfrowe porządki.', price: 37, type: ServiceType.ONE_TIME, icon: 'Settings', image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-AI-05', name: 'Etyka AI w Twoim biurze', description: 'Co wolno, a czego nie, używając sztucznej inteligencji.', price: 49, type: ServiceType.ONE_TIME, icon: 'Shield', image: 'https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&q=80&w=800', isActive: true },

  // --- MENTAL HEALTH ---
  { id: 'SRV-MH-01', name: 'Cyfrowy detoks w 15 minut', description: 'Jak odzyskać spokój bez wyrzucania telefonu.', price: 9, type: ServiceType.ONE_TIME, icon: 'Smartphone', image: 'https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-MH-02', name: 'Trening odporności na stres (Resilience)', description: 'Techniki jednostek specjalnych dla korporacji.', price: 33, type: ServiceType.ONE_TIME, icon: 'Heart', image: 'https://images.unsplash.com/photo-1522204538344-922f76ecc041?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-MH-03', name: 'Sztuka asertywności na Teamsach', description: 'Jak mówić "nie" bez poczucia winy.', price: 21, type: ServiceType.ONE_TIME, icon: 'MessageSquare', image: 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-MH-04', name: 'Sen jako Twój najlepszy projekt', description: 'Biohacking nocnej regeneracji.', price: 44, type: ServiceType.ONE_TIME, icon: 'Moon', image: 'https://images.unsplash.com/photo-1511296933631-18b46797e652?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-MH-05', name: 'Praca z domu i samotność', description: 'Jak budować relacje w trybie remote.', price: 15, type: ServiceType.ONE_TIME, icon: 'Users', image: 'https://images.unsplash.com/photo-1593642532973-d31b6557fa68?auto=format&fit=crop&q=80&w=800', isActive: true },

  // --- FINANCE & GROWTH ---
  { id: 'SRV-FIN-01', name: 'Inwestowanie dla ostrożnych', description: 'Podstawy budowania poduszki finansowej.', price: 28, type: ServiceType.ONE_TIME, icon: 'DollarSign', image: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-FIN-02', name: 'Psychologia zakupów online', description: 'Jak nie dać się zmanipulować algorytmom.', price: 7, type: ServiceType.ONE_TIME, icon: 'ShoppingCart', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-FIN-03', name: 'Negocjacje podwyżki w 2026', description: 'Nowoczesne argumenty oparte na danych.', price: 42, type: ServiceType.ONE_TIME, icon: 'TrendingUp', image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-FIN-04', name: 'Personal Branding wewnątrz firmy', description: 'Jak być widocznym, nie będąc nachalnym.', price: 19, type: ServiceType.ONE_TIME, icon: 'UserCheck', image: 'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-FIN-05', name: 'Emerytura 2.0', description: 'Zrozumieć PPK, IKE i IKZE bez bólu głowy.', price: 36, type: ServiceType.ONE_TIME, icon: 'Landmark', image: 'https://images.unsplash.com/photo-1565514020176-6c2235b8b3a9?auto=format&fit=crop&q=80&w=800', isActive: true },

  // --- LIFESTYLE ---
  { id: 'SRV-LIFE-01', name: 'Bajka na dobranoc: Robot, który chciał mieć sny', description: 'Audio dla dzieci pracowników.', price: 11, type: ServiceType.ONE_TIME, icon: 'Baby', image: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-LIFE-02', name: 'Kuchnia w 15 minut', description: 'Meal-prep dla zapracowanych.', price: 24, type: ServiceType.ONE_TIME, icon: 'Utensils', image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-LIFE-03', name: 'Hobby zamiast scrollowania', description: 'Jak znaleźć pasję, która nie wymaga ekranu.', price: 17, type: ServiceType.ONE_TIME, icon: 'Compass', image: 'https://images.unsplash.com/photo-1455355675860-e883e35ab3a7?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-LIFE-04', name: 'Podróże z nielimitowanym urlopem', description: 'Jak planować workation.', price: 48, type: ServiceType.ONE_TIME, icon: 'Plane', image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=800', isActive: true },
  { id: 'SRV-LIFE-05', name: 'Komunikacja między pokoleniami', description: 'Jak dogadać się z Gen Z i Boomerami.', price: 39, type: ServiceType.ONE_TIME, icon: 'Users', image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=800', isActive: true }
];

export const INITIAL_TICKETS: SupportTicket[] = [
    {
        id: 'TCK-2025-001',
        subject: 'Błąd przy zakupie Spotify',
        category: 'VOUCHER',
        priority: 'NORMAL',
        status: 'OPEN',
        creatorId: 'EMP-001',
        creatorName: 'Jan Kowalski',
        companyId: 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        messages: [
            {
                id: 'MSG-1',
                ticketId: 'TCK-2025-001',
                senderId: 'EMP-001',
                senderName: 'Jan Kowalski',
                senderRole: Role.EMPLOYEE,
                message: 'Dzień dobry, pobrało mi punkty ale nie dostałem kodu do Spotify. Proszę o pomoc.',
                timestamp: new Date(Date.now() - 86400000).toISOString()
            }
        ]
    }
];
