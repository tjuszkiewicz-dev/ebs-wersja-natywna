
// Central Financial Logic
// Single Source of Truth for fees, taxes and totals.

export const FINANCIAL_CONSTANTS = {
    DEFAULT_SUCCESS_FEE: 0.20, // 20%
    VAT_RATE: 0.23 // 23%
};

export interface OrderCalculation {
    voucherValue: number;
    feeNet: number;
    feeVat: number;
    feeGross: number;
    totalPayable: number;
}

/**
 * Calculates full order breakdown based on requested voucher amount.
 * @param voucherAmount - Net value for employees (1:1)
 * @param feePercentage - Optional override (default 20%)
 */
export const calculateOrderTotals = (voucherAmount: number, feePercentage: number = FINANCIAL_CONSTANTS.DEFAULT_SUCCESS_FEE): OrderCalculation => {
    // 1. Voucher Part (Note: No VAT on MPV vouchers themselves at issuance)
    const voucherValue = voucherAmount;

    // 2. Service Fee (Commission)
    const feeNet = voucherAmount * feePercentage;
    
    // 3. VAT on Service Fee only
    const feeVat = feeNet * FINANCIAL_CONSTANTS.VAT_RATE;
    
    // 4. Gross Fee
    const feeGross = feeNet + feeVat;

    // 5. Total
    const totalPayable = voucherValue + feeGross;

    return {
        voucherValue: Number(voucherValue.toFixed(2)),
        feeNet: Number(feeNet.toFixed(2)),
        feeVat: Number(feeVat.toFixed(2)),
        feeGross: Number(feeGross.toFixed(2)),
        totalPayable: Number(totalPayable.toFixed(2))
    };
};
