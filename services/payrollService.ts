
import { User, PayrollEntry, ContractType, PayrollConfig, PayrollDecision, PayrollSnapshot } from '../types';
import { generateUUID } from '../utils/generators';

// RE-EXPORT for backward compatibility with existing imports
export { generateUUID, generateSecurePassword } from '../utils/generators';

// --- 1. JSON KONFIGURACYJNY (Prawo) ---
// To jest źródło prawdy dla walidacji.
export const PAYROLL_CONFIG_2026: PayrollConfig = {
  year: 2026,
  uop: {
    min_netto: 3606.00,
    min_brutto: 4806.00
  },
  zlecenie: {
    min_stawka_brutto_h: 31.40,
    min_stawka_netto_h: {
      chorobowe: 25.36,
      bez_chorobowego: 24.00
    }
  }
};

// Declare global XLSX object loaded via CDN
declare const XLSX: {
    read: (data: any, options: any) => any;
    utils: {
        sheet_to_json: (sheet: any, options?: any) => any[];
        aoa_to_sheet: (data: any[][]) => any;
        book_new: () => any;
        book_append_sheet: (wb: any, ws: any, name: string) => void;
        json_to_sheet: (data: any[]) => any;
    };
    writeFile: (wb: any, filename: string) => void;
};

// --- VALIDATORS (EPS CORE) ---

export const validatePesel = (pesel: string): boolean => {
    if (!/^\d{11}$/.test(pesel)) return false;
    const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    let sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(pesel[i]) * weights[i];
    }
    const control = (10 - (sum % 10)) % 10;
    return control === parseInt(pesel[10]);
};

// Validates Polish IBAN (28 chars, PL prefix or not)
// Uses Modulo 97 algorithm
export const validatePLIBAN = (iban: string): boolean => {
    // Remove spaces
    let clean = iban.replace(/\s+/g, '').toUpperCase();
    
    // Check length (Polish IBAN is 28 chars with PL, or 26 without)
    if (clean.length === 26) {
        clean = 'PL' + clean;
    }
    if (clean.length !== 28) return false;
    if (!clean.startsWith('PL')) return false;

    // Move first 4 chars to end
    const rearranged = clean.substring(4) + clean.substring(0, 4);
    
    // Replace letters with numbers (A=10, B=11... Z=35)
    // PL = P(25) L(21) -> 2521
    let numeric = '';
    for (let i = 0; i < rearranged.length; i++) {
        const charCode = rearranged.charCodeAt(i);
        if (charCode >= 65 && charCode <= 90) {
            numeric += (charCode - 55).toString();
        } else {
            numeric += rearranged[i];
        }
    }

    // Modulo 97 on big integer
    // JavaScript supports BigInt
    try {
        const remainder = BigInt(numeric) % 97n;
        return remainder === 1n;
    } catch {
        return false;
    }
};

// --- CORE PAYROLL LOGIC (JSON-BACKED) ---

/**
 * Calculates the statutory minimum Net wage using the CONFIG JSON.
 */
export const calculateStatutoryMinNet = (contractType: ContractType, hours: number = 160, hasSicknessInsurance: boolean = true): number => {
    const config = PAYROLL_CONFIG_2026;
    if (contractType === ContractType.UOP) {
        return config.uop.min_netto;
    } else {
        // UZ: Hours * Hourly Rate from Config
        const rate = hasSicknessInsurance 
            ? config.zlecenie.min_stawka_netto_h.chorobowe 
            : config.zlecenie.min_stawka_netto_h.bez_chorobowego;
        return Math.round((hours * rate) * 100) / 100;
    }
};

/**
 * Creates a JSON Decision object (Intencja)
 */
const createDecision = (
    contractType: ContractType, 
    inputData: PayrollDecision['input_data'], 
    split: PayrollDecision['split'], 
    validation: PayrollDecision['validation'],
    empId?: string
): PayrollDecision => {
    return {
        employee_id: empId,
        contract_type: contractType,
        input_data: inputData,
        split: split,
        validation: validation,
        timestamp: new Date().toISOString()
    };
};

/**
 * Converts a working Entry into a Frozen Snapshot (Locked)
 */
export const createSnapshot = (entry: PayrollEntry): PayrollSnapshot => {
    return {
        snapshot_id: `SNAP-${generateUUID()}`,
        employee_email: entry.email,
        employee_name: entry.employeeName,
        matched_user_id: entry.matchedUserId,
        contract_type: entry.contractType,
        final_netto_cash: entry.cashPartNet,
        final_netto_voucher: entry.voucherPartNet,
        hours_paid: entry.cashHours ?? (entry.contractType === ContractType.UOP ? 0 : entry.totalHours),
        hours_voucher: entry.contractType === ContractType.UZ ? (entry.totalHours - (entry.cashHours ?? entry.totalHours)) : 0,
        config_version: PAYROLL_CONFIG_2026.year,
        locked_at: new Date().toISOString()
    };
};

/**
 * Validates and splits the declared Net amount into Cash (Minimum) and Vouchers (Excess).
 */
export const calculateDefaultSplit = (declaredNet: number, minNet: number) => {
    if (declaredNet < minNet) {
        return {
            isValid: false,
            cashPart: declaredNet,
            voucherPart: 0,
            error: `Kwota poniżej minimum ustawowego (${minNet} PLN)`
        };
    }

    const excess = declaredNet - minNet;
    return {
        isValid: true,
        cashPart: minNet, // Default: Pay only minimum in cash
        voucherPart: excess, // Rest in vouchers (Tax optimization)
        error: undefined
    };
};

/**
 * UOP MANUAL OVERRIDE (Monthly)
 */
export const validateManualSplit = (totalNet: number, minNet: number, proposedCash: number) => {
    if (proposedCash < minNet) {
        return {
            isValid: false,
            error: `Wynagrodzenie zasadnicze nie może być niższe niż minimum (${minNet} PLN)`
        };
    }
    if (proposedCash > totalNet) {
        return {
            isValid: false,
            error: `Kwota gotówki przekracza deklarowane netto`
        };
    }
    return {
        isValid: true,
        voucherPart: totalNet - proposedCash,
        error: undefined
    };
};

/**
 * UZ MANUAL OVERRIDE (Hourly) - JSON Config Aware
 */
export const recalculateUzSplit = (totalNet: number, totalHours: number, cashHours: number, hasSicknessInsurance: boolean = true) => {
    if (cashHours < 0 || cashHours > totalHours) {
        return {
            isValid: false,
            error: `Liczba godzin gotówkowych (max: ${totalHours}) nieprawidłowa.`
        };
    }

    const config = PAYROLL_CONFIG_2026;
    const rate = hasSicknessInsurance 
        ? config.zlecenie.min_stawka_netto_h.chorobowe 
        : config.zlecenie.min_stawka_netto_h.bez_chorobowego;
        
    const requiredCash = Math.round((cashHours * rate) * 100) / 100;

    if (requiredCash > totalNet) {
        return {
            isValid: false,
            error: `Wymagana gotówka (${requiredCash} PLN) przekracza budżet (${totalNet} PLN).`
        };
    }

    return {
        isValid: true,
        cashPart: requiredCash,
        voucherPart: totalNet - requiredCash,
        error: undefined
    };
};

// --- EXCEL PARSER ---

export const parseAndMatchPayroll = async (file: File, users: User[]): Promise<PayrollEntry[]> => {
    // Helper: Fuzzy match column index
    const findColIndex = (headers: string[], keys: string[]) => {
        return headers.findIndex(h => keys.some(k => String(h).toLowerCase().includes(k)));
    };

    const parseCurrency = (val: any) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        const str = String(val).replace(/[^\d.,]/g, '').replace(',', '.');
        return parseFloat(str) || 0;
    };

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                if (!data) return reject("Brak danych");

                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                if (rows.length < 2) return reject("Pusty plik");

                const headers = (rows[0] as string[]).map(h => String(h).trim());
                
                // Detect Columns (NETTO FOCUS)
                const emailIdx = findColIndex(headers, ['email', 'e-mail', 'mail', 'login']);
                const nameIdx = findColIndex(headers, ['imię', 'nazwisko', 'pracownik', 'osoba', 'name']);
                const netAmountIdx = findColIndex(headers, ['netto', 'do wypłaty', 'na rękę', 'kwota netto', 'salary net']);
                const contractIdx = findColIndex(headers, ['umowa', 'typ', 'contract']);
                const hoursIdx = findColIndex(headers, ['godziny', 'liczba godzin', 'hours', 'h']);
                
                const results: PayrollEntry[] = [];

                // Iterate rows (skip header)
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i] as any[];
                    if (!row || row.length === 0) continue;

                    const email = emailIdx !== -1 ? String(row[emailIdx]).trim() : '';
                    const rawName = nameIdx !== -1 ? String(row[nameIdx]).trim() : `Pracownik ${i}`;
                    const rawContract = contractIdx !== -1 ? String(row[contractIdx]).toLowerCase() : 'uop';
                    const rawHours = hoursIdx !== -1 ? parseFloat(row[hoursIdx]) : 160; 
                    const declaredNet = parseCurrency(netAmountIdx !== -1 ? row[netAmountIdx] : 0);

                    if (!email && !rawName) continue;

                    // 1. Determine Contract Logic
                    let contractType = ContractType.UOP;
                    if (rawContract.includes('zlecen') || rawContract.includes('uz')) {
                        contractType = ContractType.UZ;
                    }

                    // 2. Calculate Statutory Minimum (The Floor) via JSON Config
                    const statutoryMin = calculateStatutoryMinNet(contractType, rawHours, true);

                    // 3. Default Distribution Strategy
                    const split = calculateDefaultSplit(declaredNet, statutoryMin);

                    // 4. Match User
                    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
                    let status: PayrollEntry['status'] = 'MISSING';
                    let matchedId = undefined;

                    if (!split.isValid) {
                        status = 'INVALID_AMOUNT';
                    } else if (existingUser) {
                        status = existingUser.status === 'INACTIVE' ? 'INACTIVE' : 'MATCHED';
                        matchedId = existingUser.id;
                    }

                    // 5. Generate DECISION JSON (Intencja)
                    const decision = createDecision(
                        contractType,
                        {
                            declared_netto: declaredNet,
                            total_hours: rawHours,
                            cash_hours: contractType === ContractType.UZ ? rawHours : undefined, // Default all cash
                            has_sickness_insurance: true
                        },
                        {
                            netto_cash: split.cashPart,
                            netto_voucher: split.voucherPart
                        },
                        {
                            is_valid: split.isValid,
                            validated_against_config: `config_${PAYROLL_CONFIG_2026.year}`,
                            error: split.error
                        },
                        matchedId
                    );

                    results.push({
                        id: `PAY-${Date.now()}-${i}`,
                        email: email,
                        employeeName: existingUser ? existingUser.name : rawName,
                        contractType: contractType,
                        declaredNetAmount: declaredNet,
                        statutoryMinNet: statutoryMin,
                        cashPartNet: split.cashPart,
                        voucherPartNet: split.voucherPart,
                        totalHours: rawHours,
                        cashHours: rawHours,
                        matchedUserId: matchedId,
                        status: status,
                        validationError: split.error,
                        hasSicknessInsurance: true,
                        decisionSnapshot: decision // Attach decision
                    });
                }

                resolve(results);

            } catch (err) {
                console.error("XLSX Parse Error", err);
                reject(err);
            }
        };
        reader.readAsBinaryString(file);
    });
};

/**
 * Generates the Official Payroll Template.
 */
export const generatePayrollTemplate = (targetUsers: User[]) => {
    const headers = ["Imię i Nazwisko", "Email (Login)", "Typ Umowy (UOP/UZ)", "Wynagrodzenie Netto (Do Wypłaty)", "Liczba Godzin (dla UZ)"];
    
    let rows: any[] = [];

    if (targetUsers.length > 0) {
        rows = targetUsers.map(u => [
            u.name,
            u.email,
            'UOP', // Default
            0,     // Placeholder for Net Amount
            160    // Default Hours
        ]);
    } else {
        // Generate Example Data if list is empty
        rows = [
            ["Jan Kowalski", "jan.kowalski@firma.pl", "UOP", 5500, 0],
            ["Anna Nowak", "anna.nowak@firma.pl", "UZ", 4200, 140]
        ];
    }

    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        
        ws['!cols'] = [
            { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 15 }
        ];
        
        // Only freeze if we have real data, otherwise keep it simple
        if (targetUsers.length > 0) {
            ws['!freeze'] = { xSplit: 0, ySplit: 1 };
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Szablon_Placowy_Netto_2026");
        
        const filename = targetUsers.length > 0 
            ? `Lista_Plac_Pracownicy_${new Date().toISOString().slice(0,10)}.xlsx`
            : `Szablon_Kalkulator_Netto_2026.xlsx`;

        XLSX.writeFile(wb, filename);
        return true;
    }
    return false;
};
