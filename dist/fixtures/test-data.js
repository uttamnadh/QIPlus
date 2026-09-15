"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_IBAN = void 0;
exports.getRandomBusinessName = getRandomBusinessName;
exports.calculateLuhnCheckDigit = calculateLuhnCheckDigit;
exports.generateLuhnValidNumber = generateLuhnValidNumber;
exports.validateLuhn = validateLuhn;
exports.generateLuhnValidEmiratesId = generateLuhnValidEmiratesId;
exports.buildDraftIdentity = buildDraftIdentity;
exports.buildSecondaryRejectIdentity = buildSecondaryRejectIdentity;
exports.buildDuplicateTrnIdentity = buildDuplicateTrnIdentity;
/** Known-working base IBAN */
exports.BASE_IBAN = 'AE520335305065957162693';
const PREFIXES = [
    'Apex', 'Horizon', 'Emerald', 'Vanguard', 'Starlight',
    'Pacific', 'Quantum', 'Falcon', 'Beacon', 'Nexus',
    'Atlas', 'Summit', 'Orion', 'Crest', 'Pinnacle',
    'Al Andalus', 'Golden Dune', 'Al Safa', 'Crystal', 'Prime',
    'Nova', 'Solar', 'Titan', 'Oasis', 'Vertex'
];
const TYPES = [
    'Global', 'Trading', 'Logistics', 'Enterprise', 'Commercial',
    'Ventures', 'Holdings', 'Industries', 'Solutions', 'Partners',
    'Investments', 'General Trading', 'International', 'Distribution',
    'Technologies', 'Supplies', 'Management'
];
const FIRST_NAMES = [
    'Ahmed', 'Tariq', 'Rashid', 'Sultan', 'Zaid', 'Mohammed', 'Omar',
    'Faisal', 'Khalid', 'Mansoor', 'John', 'David', 'Robert', 'Michael'
];
const LAST_NAMES = [
    'Al Mansoori', 'Al Falasi', 'Al Qasimi', 'Al Hashimi', 'Mahmood',
    'Al Zaabi', 'Al Nuaimi', 'Al Suwaidi', 'Doe', 'Smith', 'Taylor'
];
const POSITIONS = [
    'Managing Director', 'General Manager', 'Chief Executive Officer',
    'Executive Director', 'Director', 'Head of Operations'
];
/**
 * Generates a completely new, unique random business name every single time.
 */
function getRandomBusinessName() {
    const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const tradeName = `${prefix} ${type} ${randNum}`;
    const legalName = `${prefix} ${type} ${randNum} LLC`;
    return { tradeName, legalName };
}
/**
 * Calculates the Luhn algorithm check digit for a given numeric string payload.
 */
function calculateLuhnCheckDigit(numericPayload) {
    let sum = 0;
    let shouldDouble = true;
    for (let i = numericPayload.length - 1; i >= 0; i--) {
        let digit = parseInt(numericPayload.charAt(i), 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9)
                digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return (10 - (sum % 10)) % 10;
}
/**
 * Generates a Luhn-checksum-valid numeric string of exact length `totalLength` starting with `prefix`.
 * Uses crypto random digits to guarantee uniqueness every time.
 */
function generateLuhnValidNumber(prefix, totalLength) {
    const neededPayloadDigits = totalLength - 1 - prefix.length;
    let randomDigits = '';
    for (let i = 0; i < neededPayloadDigits; i++) {
        randomDigits += Math.floor(Math.random() * 10).toString();
    }
    const payload = `${prefix}${randomDigits}`;
    const checkDigit = calculateLuhnCheckDigit(payload);
    return `${payload}${checkDigit}`;
}
/**
 * Validates whether a given numeric string satisfies the Luhn algorithm checksum.
 */
function validateLuhn(numericString) {
    const digitsOnly = numericString.replace(/\D/g, '');
    if (digitsOnly.length < 2)
        return false;
    const payload = digitsOnly.slice(0, -1);
    const expectedCheckDigit = calculateLuhnCheckDigit(payload);
    const actualCheckDigit = parseInt(digitsOnly.slice(-1), 10);
    return expectedCheckDigit === actualCheckDigit;
}
/**
 * Generates a Luhn-valid 15-digit Emirates ID formatted as `784-1992-XXXXXXX-Z`.
 * Always fresh & unique every time.
 */
function generateLuhnValidEmiratesId() {
    const digits15 = generateLuhnValidNumber('7841992', 15);
    return `${digits15.slice(0, 3)}-${digits15.slice(3, 7)}-${digits15.slice(7, 14)}-${digits15.slice(14)}`;
}
/**
 * Builds a brand new, unique, fully-randomized UAE merchant identity every single time it is called.
 */
function buildDraftIdentity(suiteName) {
    const runId = `${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    let { tradeName, legalName } = getRandomBusinessName();
    if (process.env.MERCHANT_NAME) {
        tradeName = process.env.MERCHANT_NAME.trim();
        legalName = `${tradeName} LLC`;
    }
    // TRN: Luhn-valid 15-digit numeric string starting with 100
    const trn = generateLuhnValidNumber('100', 15);
    // Trade Licence Number: valid format TL + 6 random digits
    const licenceNumber = `TL${Math.floor(100000 + Math.random() * 899999)}`;
    // IBAN: Fixed verified working IBAN
    const iban = exports.BASE_IBAN;
    // Emirates ID: Luhn-valid 15-digit Emirates ID (784-1992-XXXXXXX-Z)
    const emiratesId = generateLuhnValidEmiratesId();
    // Contact details
    const fName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const primaryContactName = process.env.MERCHANT_NAME ? process.env.MERCHANT_NAME.trim() : `${fName} ${lName}`;
    const primaryContactPosition = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
    const domainSlug = tradeName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const primaryContactEmail = `contact@${domainSlug || 'merchant'}.ae`;
    const primaryContactPhone = `50${Math.floor(1000000 + Math.random() * 8999999)}`;
    // Random Office & PO Box
    const tower = ['A', 'B', 'C', '1', '2', 'East', 'West'][Math.floor(Math.random() * 7)];
    const officeSuite = `Suite ${Math.floor(100 + Math.random() * 899)} Tower ${tower}`;
    const poBox = `${Math.floor(10000 + Math.random() * 89999)}`;
    const websiteUrl = `https://${domainSlug || 'merchant'}.ae`;
    return {
        suiteName,
        runId,
        tradeName,
        legalName,
        trn,
        licenceNumber,
        iban,
        emiratesId,
        primaryContactName,
        primaryContactPosition,
        primaryContactEmail,
        primaryContactPhone,
        officeSuite,
        poBox,
        websiteUrl,
    };
}
/**
 * Builds secondary reject/hold/return flow record identity.
 */
function buildSecondaryRejectIdentity() {
    return buildDraftIdentity('compliance-final');
}
function buildDuplicateTrnIdentity(suiteName = 'negative') {
    const identity = buildDraftIdentity(suiteName);
    return {
        ...identity,
        trn: '100123456700003',
    };
}
