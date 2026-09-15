"use strict";
/**
 * Smart UAE Regulatory Data & Security Payload Generator.
 * WHY: Provides realistic and invalid UAE Emirates IDs, TRNs, IBANs, SWIFT codes,
 * along with boundary, XSS, SQLi, Arabic, and whitespace edge case payloads.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SECURITY_PAYLOADS = exports.UaeDataGenerator = void 0;
class UaeDataGenerator {
    /** Generate a valid or invalid 15-digit Emirates ID (784-YYYY-XXXXXXX-Z). */
    static generateEmiratesId(options) {
        const valid = options?.valid ?? true;
        if (!valid) {
            if (options?.invalidPrefix)
                return '999-1992-1448568-4';
            if (options?.missingHyphens)
                return '784199214485684';
            if (options?.invalidChecksum)
                return '784-1992-1448568-9';
            return '784-1800-0000000-0'; // Invalid birth year
        }
        const year = Math.floor(1970 + Math.random() * 35);
        const seq = Math.floor(1000000 + Math.random() * 9000000);
        const check = Math.floor(1 + Math.random() * 8);
        return `784-${year}-${seq}-${check}`;
    }
    /** Generate a valid or invalid 15-digit FTA Tax Registration Number (TRN). */
    static generateTrn(options) {
        if (options?.short)
            return '100228320';
        if (options?.long)
            return '1002283206800249999';
        if (options?.invalidPrefix)
            return '200228320680024';
        if (options?.alpha)
            return '100228320680ABC';
        // Valid 15-digit TRN starting with 100
        const rest = Math.floor(100000000000 + Math.random() * 900000000000).toString();
        return `100${rest}`.slice(0, 15);
    }
    /** Generate a valid or invalid UAE IBAN (AE + 21 alphanumeric digits). */
    static generateIban(options) {
        if (options?.nonUae)
            return 'GB29NWBK60161331926819';
        if (options?.short)
            return 'AE070330001234567';
        if (options?.invalidChecksum)
            return 'AE000330001234567890123';
        // Valid UAE IBAN (AE + 2-digit check + 3-digit bank code + 16-digit account)
        const check = Math.floor(10 + Math.random() * 89);
        const bank = '033'; // Dubai Islamic Bank or similar
        const account = Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString().slice(0, 16);
        return `AE${check}${bank}${account}`;
    }
    /** Generate a valid or invalid SWIFT/BIC code (8 or 11 chars). */
    static generateSwift(options) {
        if (options?.short)
            return 'EBBKAE';
        if (options?.invalidCountry)
            return 'EBBKXX2D';
        return 'EBBKAE2DXXX'; // Emirates NBD Dubai SWIFT
    }
}
exports.UaeDataGenerator = UaeDataGenerator;
exports.SECURITY_PAYLOADS = {
    xssScript: '<script>alert("XSS_VULN")</script>',
    xssImage: '<img src=x onerror=alert("XSS")>',
    sqlInjection: "' OR '1'='1'; DROP TABLE merchants;--",
    arabicText: 'شركة الأمل للتجارة العامة ذ.م.م',
    unicodeGerman: 'Müller & Söhne Handels GmbH',
    unicodeChinese: '李伟贸易有限公司',
    unicodeSymbols: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/',
    maxLength256: 'A'.repeat(256),
    maxLength500: 'B'.repeat(500),
    whitespaceOnly: '   \t\n   ',
    singleChar: 'X',
    emojiText: '🏢 Merchant Tech Ltd 🚀',
};
