
import {
  validatePesel,
  validatePLIBAN,
  calculateStatutoryMinNet,
  calculateDefaultSplit,
  validateManualSplit,
  recalculateUzSplit,
  PAYROLL_CONFIG_2026,
} from './payrollService';
import { ContractType } from '../types';

console.log('--- Running payrollService.test.ts ---');

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ Passed: ${message}`);
    passedTests++;
  } else {
    console.error(`❌ Failed: ${message}`);
    failedTests++;
  }
}

// Mock PAYROLL_CONFIG_2026 for consistent testing (already imported and defined)
const MOCK_UOP_MIN_NETTO = PAYROLL_CONFIG_2026.uop.min_netto;
const MOCK_UZ_RATE_CHOROBOWE = PAYROLL_CONFIG_2026.zlecenie.min_stawka_netto_h.chorobowe;
const MOCK_UZ_RATE_BEZ_CHOROBOWEGO = PAYROLL_CONFIG_2026.zlecenie.min_stawka_netto_h.bez_chorobowego;

// Test Suite
function runTests() {
  // --- 1. validatePesel ---
  console.log('\n--- Testing validatePesel ---');
  assert(validatePesel('90051209876'), 'Valid PESEL should return true');
  assert(!validatePesel('90051209870'), 'Invalid PESEL (wrong checksum) should return false');
  assert(!validatePesel('123'), 'Too short PESEL should return false');
  assert(!validatePesel('ABCDEFGHIJK'), 'Non-numeric PESEL should return false');

  // --- 2. validatePLIBAN ---
  console.log('\n--- Testing validatePLIBAN ---');
  assert(validatePLIBAN('PL61109010140000071219812874'), 'Valid PL IBAN with prefix should return true');
  assert(validatePLIBAN('61109010140000071219812874'), 'Valid PL IBAN without prefix should return true');
  assert(!validatePLIBAN('PL61109010140000071219812875'), 'Invalid PL IBAN (wrong checksum) should return false');
  assert(!validatePLIBAN('DE12345678901234567890'), 'Non-PL IBAN should return false');
  assert(!validatePLIBAN('PL123'), 'Too short IBAN should return false');

  // --- 3. calculateStatutoryMinNet ---
  console.log('\n--- Testing calculateStatutoryMinNet ---');
  assert(calculateStatutoryMinNet(ContractType.UOP) === MOCK_UOP_MIN_NETTO, 'UoP min netto should match config');
  assert(calculateStatutoryMinNet(ContractType.UZ, 160, true) === Math.round(160 * MOCK_UZ_RATE_CHOROBOWE * 100) / 100, 'UZ min netto (with sickness) for 160h should match config');
  assert(calculateStatutoryMinNet(ContractType.UZ, 80, false) === Math.round(80 * MOCK_UZ_RATE_BEZ_CHOROBOWEGO * 100) / 100, 'UZ min netto (without sickness) for 80h should match config');

  // --- 4. calculateDefaultSplit ---
  console.log('\n--- Testing calculateDefaultSplit ---');
  let split1 = calculateDefaultSplit(5000, MOCK_UOP_MIN_NETTO);
  assert(split1.isValid && split1.cashPart === MOCK_UOP_MIN_NETTO && split1.voucherPart === (5000 - MOCK_UOP_MIN_NETTO), 'Default split for net > min should be correct');
  let split2 = calculateDefaultSplit(3000, MOCK_UOP_MIN_NETTO);
  assert(!split2.isValid && split2.cashPart === 3000 && split2.voucherPart === 0, 'Default split for net < min should be invalid');
  let split3 = calculateDefaultSplit(MOCK_UOP_MIN_NETTO, MOCK_UOP_MIN_NETTO);
  assert(split3.isValid && split3.cashPart === MOCK_UOP_MIN_NETTO && split3.voucherPart === 0, 'Default split for net == min should be correct');

  // --- 5. validateManualSplit (UoP) ---
  console.log('\n--- Testing validateManualSplit (UoP) ---');
  let manualUop1 = validateManualSplit(5000, MOCK_UOP_MIN_NETTO, 4000);
  assert(manualUop1.isValid && manualUop1.voucherPart === 1000, 'Manual split (UoP) with cash > min should be valid');
  let manualUop2 = validateManualSplit(5000, MOCK_UOP_MIN_NETTO, 3000); // 3000 < MOCK_UOP_MIN_NETTO
  assert(!manualUop2.isValid, 'Manual split (UoP) with cash < min should be invalid');
  let manualUop3 = validateManualSplit(5000, MOCK_UOP_MIN_NETTO, 6000);
  assert(!manualUop3.isValid, 'Manual split (UoP) with cash > total should be invalid');

  // --- 6. recalculateUzSplit (UZ) ---
  console.log('\n--- Testing recalculateUzSplit (UZ) ---');
  const uzTotalNet = 5000;
  const uzTotalHours = 160;
  const uzRateChorobowe = MOCK_UZ_RATE_CHOROBOWE;
  const uzRateBezChorobowego = MOCK_UZ_RATE_BEZ_CHOROBOWEGO;

  let uzSplit1 = recalculateUzSplit(uzTotalNet, uzTotalHours, 100, true);
  assert(uzSplit1.isValid && Math.abs(uzSplit1.cashPart - (100 * uzRateChorobowe)) < 0.01 && uzSplit1.voucherPart === (uzTotalNet - (100 * uzRateChorobowe)), 'UZ split with valid cash hours should be correct (with sickness)');

  let uzSplit2 = recalculateUzSplit(uzTotalNet, uzTotalHours, 50, false);
  assert(uzSplit2.isValid && Math.abs(uzSplit2.cashPart - (50 * uzRateBezChorobowego)) < 0.01, 'UZ split with valid cash hours should be correct (without sickness)');

  let uzSplit3 = recalculateUzSplit(uzTotalNet, uzTotalHours, 180, true);
  assert(!uzSplit3.isValid, 'UZ split with cash hours > total hours should be invalid');

  let uzSplit4 = recalculateUzSplit(1000, uzTotalHours, 160, true); // (160 * uzRateChorobowe) > 1000
  assert(!uzSplit4.isValid, 'UZ split with required cash > total net should be invalid');

  console.log('\n--- Test Summary ---');
  console.log(`✅ Total tests passed: ${passedTests}`);
  console.log(`❌ Total tests failed: ${failedTests}`);
  if (failedTests > 0) {
    console.error('Some tests failed. Please check the logs above.');
    // In a real CI environment, you might exit with a non-zero code here.
    // process.exit(1);
  } else {
    console.log('All tests passed successfully!');
  }
}

// Run the tests
runTests();
