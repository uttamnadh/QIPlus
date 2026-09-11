import * as fs from 'fs';
import * as path from 'path';
import { AgentConfig, RoleName } from './types';

export const DEFAULT_CONFIG: AgentConfig = {
  baseURL: 'https://idms-uat.qiplus.ae',
  apiBase: 'https://idms-uat.qiplus.ae/qi-plus-merchant-onboarding-services/api/v1',
  roles: {
    onboarding: {
      username: 'Sukesh',
      password: 'Qa@12345',
      totpSecret: '',
      displayName: 'Onboarding Officer',
      enabled: true,
    },
    compliance: {
      username: 'bhanu',
      password: 'Qa@123456789',
      totpSecret: 'O5JK3K56FHMKGX67KMQAS65YSXXTAAT4',
      displayName: 'Compliance Officer',
      enabled: true,
    },
    approver: {
      username: 'uttamnadh',
      password: 'Qa@123456789',
      totpSecret: 'H2SG6MBNDHY4OFPOYBB2WHVGTZAMYT23',
      displayName: 'Final Approver',
      enabled: true,
    },
    auditor: {
      username: 'auditor',
      password: 'Passw0rd!',
      totpSecret: '',
      displayName: 'Auditor',
      enabled: true,
    },
    admin: {
      username: 'admin',
      password: 'Passw0rd!',
      totpSecret: '',
      displayName: 'Administrator',
      enabled: true,
    },
  },
  exploration: {
    maxPagesPerRole: 30,
    maxDepth: 4,
    pageTimeoutMs: 15000,
    formFuzzTimeoutMs: 10000,
    totalTimeoutMs: 1800000,
    screenshotOnEveryPage: true,
    headless: true,
  },
  features: {
    formFuzzing: true,
    apiProbing: true,
    accessibilityScan: true,
    mobileViewport: true,
    runComparison: true,
    notifications: false,
  },
  mobile: {
    viewports: [
      { name: 'iPhone 14', width: 390, height: 844, deviceScaleFactor: 3 },
      { name: 'Galaxy S21', width: 360, height: 800, deviceScaleFactor: 3 },
      { name: 'iPad Mini', width: 768, height: 1024, deviceScaleFactor: 2 },
    ],
    pagesToTest: ['/dashboard', '/merchants', '/merchants/new'],
  },
  notifications: {
    webhookUrl: '',
    platform: 'slack',
    mentionOnCritical: true,
    quietIfNoNewBugs: true,
    quietDays: ['Saturday', 'Sunday'],
  },
  history: {
    retentionRuns: 30,
    outputDir: 'agent-results',
  },
  retry: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 15000,
    backoffMultiplier: 2,
  },
};

/**
 * Common Fuzz Payloads across categories
 */
export const FUZZ_PAYLOADS = {
  xss: [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    'javascript:alert(1)',
  ],
  sqlInjection: [
    "' OR 1=1 --",
    "'; DROP TABLE merchants; --",
    "1; SELECT * FROM users",
  ],
  boundaryNumbers: {
    zero: '0',
    negative: '-500',
    float: '0.0001',
    veryLarge: '999999999999',
  },
  longString: 'A'.repeat(5001),
  whitespaceOnly: '   ',
  emptyString: '',
  specialChars: '!@#$%^&*(){}[]|\\:";\'<>?,./~`',
  emoji: '🚀⚠️💰🎉 TestingEmoji',
  uaeSpecific: {
    invalidTrnShort: '12345',
    invalidTrnPrefix: '200123456700003', // Starts with 200 instead of 100
    invalidIbanForeign: 'GB29NWBK60161331926819', // Non-AE
    invalidIbanShort: 'AE12345',
    invalidEmiratesId: '1234567890123',
    invalidSwiftShort: 'EBIL',
  },
};

/**
 * BRD Validation rules (used only for field checks & flow validation, NOT UI discovery)
 */
export const BRD_VALIDATION_RULES = {
  trn: {
    pattern: /^100\d{12}$/,
    rule: 'Must be 15 digits starting with 100',
  },
  atv: {
    rule: 'Average Transaction Value cannot exceed Monthly Volume',
    check: (atv: number, monthly: number) => atv <= monthly,
  },
  uboAge: {
    rule: 'UBO must be 18 years or older',
    minAge: 18,
  },
  shareholding: {
    rule: 'Total shareholding must equal 100%',
    exact: 100,
  },
  iban: {
    pattern: /^AE\d{21}$/,
    rule: 'UAE IBAN format: AE followed by 21 digits',
  },
  swift: {
    pattern: /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/,
    rule: 'SWIFT/BIC must be 8 or 11 characters',
  },
  emiratesId: {
    pattern: /^784-\d{4}-\d{7}-\d$/,
    rule: 'Emirates ID format: 784-YYYY-NNNNNNN-C',
  },
  workflowStages: [
    'DRAFT',
    'PENDING_DOCUMENTS',
    'COMPLIANCE_REVIEW',
    'FINAL_APPROVAL',
    'APPROVED',
    'ACTIVE',
  ],
};

/**
 * Load configuration combining defaults, museqa.config.json, and environment variables
 */
export function loadConfig(): AgentConfig {
  let config = { ...DEFAULT_CONFIG };

  const configPath = path.resolve(process.cwd(), 'museqa.config.json');
  if (fs.existsSync(configPath)) {
    try {
      const fileData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = deepMerge(config, fileData);
    } catch (e) {
      console.warn('⚠️ Failed to parse museqa.config.json, using defaults.');
    }
  }

  // Environment variable overrides
  if (process.env.MUSEQA_BASE_URL) config.baseURL = process.env.MUSEQA_BASE_URL;
  if (process.env.MUSEQA_HEADLESS !== undefined) {
    config.exploration.headless = process.env.MUSEQA_HEADLESS !== 'false';
  }
  if (process.env.MUSEQA_WEBHOOK_URL) {
    if (!config.notifications) config.notifications = { ...DEFAULT_CONFIG.notifications! };
    config.notifications.webhookUrl = process.env.MUSEQA_WEBHOOK_URL;
    config.features.notifications = true;
  }

  return config;
}

function deepMerge(target: any, source: any): any {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) Object.assign(output, { [key]: source[key] });
        else output[key] = deepMerge(target[key], source[key]);
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}
