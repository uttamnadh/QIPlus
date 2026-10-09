/**
 * ============================================================================
 * QiPlus Merchant Test Data & Lifecycle Fixtures
 *
 * Framework Architect & Lead Automation Engineer: Bhanu Kiran
 * Copyright (c) 2026 Bhanu Kiran. All rights reserved.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

import { buildDraftIdentity, SuiteName, BASE_IBAN } from './test-data';

/**
 * Base template for test merchant data.
 */
const BASE_MERCHANT_TEMPLATE = {
  // ── Step 1: Profile ──────────────────────────────────────────
  tradeName: 'Apex Global Trading',
  legalName: 'Apex Global Trading LLC',
  dateOfIncorporation: { day: '15', month: '01', year: '2020' },
  countryOfIncorporation: 'United Arab Emirates',
  legalForm: 'LLC',
  trn: '100123456700003',
  websiteUrl: 'https://apexglobal.ae',
  primaryContactName: 'John Doe',
  primaryContactPosition: 'Managing Director',
  primaryContactEmail: 'john@apexglobal.ae',
  primaryContactPhone: '501234567', // typed into tel input; auto-formatted

  // ── Registered Address ───────────────────────────────────────
  registeredAddress: {
    floorOffice: 'Suite 101 Tower A', // no commas — backend rejects them
    areaDistrict: 'Business Bay',
    emirateCity: 'Dubai',
    poBox: '12345',
    country: 'United Arab Emirates',
  },

  // ── Licence ──────────────────────────────────────────────────
  licence: {
    authority: 'DED',
    number: 'TL123456',
    issueDate: { day: '01', month: '01', year: '2024' },
    expiryDate: { day: '01', month: '01', year: '2028' },
    jurisdiction: 'Dubai',
    activities: 'General Trading and Distribution of Goods', // no '&'
  },

  // ── Step 2: Business ─────────────────────────────────────────
  business: {
    primaryProducts: 'General Trading and Distribution of Goods',
    expectedMonthlyVolume: '500000',
    expectedMonthlyCount: '100',
    averageTransactionValue: '5000', // auto-calculated but editable
    yearsInOperation: '3',
    customerCountries: ['United Arab Emirates'],
  },

  // ── Step 3: Ownership (Shareholders) ─────────────────────────
  shareholders: [
    {
      fullLegalName: 'Primary Shareholder LLC',
      entityOrIndividual: 'Individual',
      countryOfRegistration: 'United Arab Emirates',
      percentShareholding: '100',
      idType: 'Emirates ID',
      emiratesIdNumber: '784-1992-1448568-4',
    },
  ],

  // ── Step 4: UBOs ─────────────────────────────────────────────
  ubos: [
    {
      fullLegalName: 'Primary Shareholder LLC',
      dateOfBirth: { day: '15', month: '06', year: '1992' },
      placeOfBirth: 'Dubai',
      nationality: 'United Arab Emirates',
      hasDualNationality: false,
      countryOfResidence: 'United Arab Emirates',
      percentShareholding: '100', // 100% carry-forward from Ownership
      idType: 'Emirates ID',
      emiratesIdNumber: '784-1992-1448568-4',
      idExpiryDate: { day: '15', month: '06', year: '2030' },
      basisOfControl: 'Ownership',
      occupation: 'Business Owner',
      pep: false,
    },
  ],

  // ── Step 5: Signatories ──────────────────────────────────────
  signatories: [
    {
      fullName: 'Jane Doe Signatory',
      designation: 'Authorized Signatory',
      nationality: 'United Arab Emirates',
      hasDualNationality: true,
      secondaryNationality: 'United Kingdom',
      countryOfResidence: 'United Arab Emirates',
      idType: 'Emirates ID',
      emiratesIdNumber: '784-1992-1448568-4',
      scopeOfAuthority: 'Full signing authority for banking and contracts',
    },
  ],

  // ── Step 6: Banking ──────────────────────────────────────────
  banking: {
    accountHolderName: 'Apex Global Trading LLC',
    bankName: 'Emirates NBD',
    branchNameEmirate: 'Business Bay Branch',
    iban: BASE_IBAN,
    swiftBic: 'EBILAEAD',
    accountCurrency: 'AED',
    accountType: 'Current',
  },
};

export type ShareholderType = 'Individual' | 'Entity';

export function promptShareholderType(): ShareholderType {
  const envType = (process.env.SHAREHOLDER_TYPE || '').trim().toLowerCase();
  if (envType === '2' || envType === 'entity' || envType === 'e') {
    return 'Entity';
  }
  return 'Individual';
}

export function getShareholderType(): ShareholderType {
  return promptShareholderType();
}

/**
 * Returns a complete, fully-randomized merchant data object customized for the run.
 */
export function getMerchantData(suiteName: SuiteName = 'positive', overrideShareholderType?: ShareholderType) {
  const identity = buildDraftIdentity(suiteName);
  const shareholderType = overrideShareholderType || getShareholderType();
  const isEntity = shareholderType === 'Entity';

  // 2-alphabet prefix + 6-digit number, e.g. TL162770
  const randomTLNumber = `TL${Math.floor(100000 + Math.random() * 900000)}`;

  const shareholderObj = isEntity
    ? {
        fullLegalName: `${identity.tradeName} Holding`,
        entityOrIndividual: 'Entity' as const,
        countryOfRegistration: 'United Arab Emirates',
        percentShareholding: '100',
        idType: 'Trade License' as const,
        tradeLicenceNumber: randomTLNumber,
        emiratesIdNumber: '',
      }
    : {
        fullLegalName: identity.primaryContactName,
        entityOrIndividual: 'Individual' as const,
        countryOfRegistration: 'United Arab Emirates',
        percentShareholding: '100',
        idType: 'Emirates ID' as const,
        emiratesIdNumber: identity.emiratesId,
        tradeLicenceNumber: '',
      };

  const uboObj = {
    fullLegalName: identity.primaryContactName,
    dateOfBirth: { day: '15', month: '06', year: '1990' },
    placeOfBirth: 'Dubai',
    nationality: 'United Arab Emirates',
    hasDualNationality: false,
    countryOfResidence: 'United Arab Emirates',
    percentShareholding: '100',
    idType: 'Emirates ID',
    emiratesIdNumber: identity.emiratesId,
    idExpiryDate: { day: '31', month: '12', year: '2030' },
    basisOfControl: 'Ownership',
    occupation: 'Managing Director',
    pep: false,
  };

  return {
    ...BASE_MERCHANT_TEMPLATE,
    tradeName: identity.tradeName,
    legalName: identity.legalName,
    trn: identity.trn,
    websiteUrl: identity.websiteUrl,
    primaryContactName: identity.primaryContactName,
    primaryContactPosition: identity.primaryContactPosition,
    primaryContactEmail: identity.primaryContactEmail,
    primaryContactPhone: identity.primaryContactPhone,
    registeredAddress: {
      ...BASE_MERCHANT_TEMPLATE.registeredAddress,
      floorOffice: identity.officeSuite,
      poBox: identity.poBox,
    },
    licence: {
      ...BASE_MERCHANT_TEMPLATE.licence,
      number: identity.licenceNumber,
    },
    shareholders: [shareholderObj],
    ubos: [uboObj],
    signatories: [
      {
        ...BASE_MERCHANT_TEMPLATE.signatories[0],
        fullName: identity.primaryContactName,
        emiratesIdNumber: identity.emiratesId,
      },
    ],
    banking: {
      ...BASE_MERCHANT_TEMPLATE.banking,
      accountHolderName: identity.legalName.replace(/[^a-zA-Z\s]/g, '').trim(), // Clean alphabets and spaces only
      iban: identity.iban,
    },
  };
}

/** Default merchant object for positive suite backwards-compatibility */
export const MERCHANT = getMerchantData('positive');

/** Role credentials used across the suite. */
export const ROLES = {
  onboarding: { username: 'Sukesh', password: 'Qa@12345', roleLabel: 'Onboarding officer', totpSecret: '' },
  compliance: { username: 'bhanu', password: 'Qa@123456789', roleLabel: 'Compliance officer', totpSecret: 'O5JK3K56FHMKGX67KMQAS65YSXXTAAT4' },
  approver:   { username: 'uttamnadh', password: 'Qa@123456789', roleLabel: 'Final approver', totpSecret: 'H2SG6MBNDHY4OFPOYBB2WHVGTZAMYT23' },
  auditor:    { username: 'auditor', password: 'Passw0rd!', roleLabel: 'Auditor', totpSecret: '' },
  userManagement: { username: 'shankar', password: 'Passw0rd!', roleLabel: 'User management', totpSecret: 'CUZN3ZAJKZPNBMQRK5LD33D3YVWE6K7N' },
} as const;

const STATE_FILE = path.join(__dirname, 'state.json');

export interface PipelineState {
  merchantId: string;
  mrn: string;
  tradeName?: string;
  legalName?: string;
  shareholderType?: string;
  submitted: boolean;
  complianceApproved: boolean;
  onHold?: boolean;
  finalApproved?: boolean;
  finalApproverDecision?: string; // 'Clear and Active' | 'Hit / Hold'
  screeningResult?: string;
  merchantStatus?: string; // 'Active' | 'Under compliance review' | 'On hold'
  auditorVerified?: boolean;
  auditorDirectoryRow?: string;
}

/** Save MRN and status flags to disk to persist across test process runs. */
export function saveState(data: Partial<PipelineState>) {
  let state = loadState();
  state = { ...state, ...data };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

/** Load MRN and status flags from disk. */
export function loadState(): PipelineState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch {}
  return { merchantId: '', mrn: '', submitted: false, complianceApproved: false };
}

export const sharedState = loadState();

export function printMerchantSubmissionSummary(data: {
  tradeName: string;
  legalName?: string;
  mrn: string;
  shareholderType?: string;
  shareholderIdType?: string;
  shareholderIdValue?: string;
  uboName?: string;
  uboShare?: string | number;
  step7Status?: string;
  suiteType?: 'POSITIVE' | 'NEGATIVE' | 'REGRESSION';
}) {
  const suite = data.suiteType || 'POSITIVE';
  console.log('\n============================================================');
  console.log(`🎉 [${suite}] MERCHANT RECORD ONBOARDED & SUBMITTED SUCCESSFULLY!`);
  console.log(`📌 MERCHANT NAME : ${data.tradeName}${data.legalName ? ` (${data.legalName})` : ''}`);
  console.log(`📄 MRN NUMBER    : ${data.mrn || 'N/A'}`);
  if (data.shareholderType) {
    const idInfo = data.shareholderIdValue ? `: ${data.shareholderIdValue}` : '';
    console.log(`🏢 SHAREHOLDER   : ${data.shareholderType} (${data.shareholderIdType || 'ID'}${idInfo})`);
  }
  if (data.uboName) {
    console.log(`👤 UBO           : ${data.uboName} (Share: ${data.uboShare || '100'}%)`);
  }
  console.log(`📊 STEP 7 UPLOADS: ${data.step7Status || 'All mandatory documents uploaded & verified'}`);
  console.log('👤 ARCHITECT      : Bhanu Kiran (QA Automation Lead)');
  console.log('============================================================\n');
}

export function printMerchantDraftSummary(data: {
  tradeName: string;
  legalName?: string;
  mrn: string;
  status?: string;
  suiteType?: 'POSITIVE' | 'NEGATIVE' | 'REGRESSION';
}) {
  const suite = data.suiteType || 'NEGATIVE';
  console.log('\n============================================================');
  console.log(`💾 [${suite}] MERCHANT RECORD SAVED AS DRAFT (NOT SUBMITTED)`);
  console.log(`📌 MERCHANT NAME : ${data.tradeName}${data.legalName ? ` (${data.legalName})` : ''}`);
  console.log(`📄 MRN NUMBER    : ${data.mrn || 'N/A'}`);
  console.log(`📊 QUEUE STATUS  : ${data.status || 'Draft'}`);
  console.log('👤 ARCHITECT     : Bhanu Kiran (QA Automation Lead)');
  console.log('============================================================\n');
}

/** Negative-suite-specific test data constants. */
export const NEGATIVE_DATA = {
  xss: {
    scriptTag: '<script>alert(1)</script>',
    imgOnerror: '"><img src=x onerror=alert(1)>',
    svgOnload: '<svg onload=alert(1)>',
  },
  boundary: {
    below25: '24.99',
    zero: '0',
    negative: '-5',
    exactly25: '25',
    exactly100: '100',
    above100: '150',
    nonNumeric: 'abc',
  },
  longString: 'A'.repeat(5001),
  whitespaceOnly: '   ',
  emoji: '🚀⚠️💰 TestEmoji',
  invalidIBAN: 'AE52ABCDEFGHIJKLMNOPQR',
  invalidIBANShort: 'AE12345',
  retiredAccount: { username: 'retired_user', password: 'OldPassword123!' },
  sqlInjection: "' OR 1=1 --",
  fakeUsername: 'nonexistent_user_xyz_99',
  fieldMatrix: {
    invalidEmail: 'not-an-email',
    invalidPhone: '12345',
    validPhone: '+971501234567',
    shortTrn: '12345',
    longTrn: '1234567890123456',
    symbolLicence: 'TL-98#76',
    longLicence: 'A'.repeat(31),
    pastDate: { day: '01', month: '01', year: '2020' },
    futureDate: { day: '01', month: '01', year: '2030' },
    invalidEmiratesId: '1234567890123',
    validEmiratesId: '784-1992-1448568-4',
    gbIban: 'GB29NWBK60161331926819',
    shortIban: 'AE12345',
    spacedIban: 'AE52 0335 3050 6595 7162 693',
    shortSwift: 'EBIL',
    nineCharSwift: 'EBILAEAD1',
    tenCharSwift: 'EBILAEAD12',
    longText200: 'A'.repeat(200),
    zeroValue: '0',
    negativeValue: '-100',
    injectionSearch: "'; DROP TABLE merchants; --",
  },
} as const;

const NEGATIVE_STATE_FILE = path.join(__dirname, 'negative-state.json');

/** Save negative-suite draft MRN to disk. */
export function saveNegativeState(data: { mrn?: string; submitted?: boolean; [key: string]: any }) {
  let state = loadNegativeState();
  state = { ...state, ...data };
  fs.writeFileSync(NEGATIVE_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

/** Load negative-suite draft MRN from disk. */
export function loadNegativeState(): { mrn: string; submitted?: boolean; [key: string]: any } {
  try {
    if (fs.existsSync(NEGATIVE_STATE_FILE)) {
      const content = fs.readFileSync(NEGATIVE_STATE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch {}
  return { mrn: '' };
}
