/**
 * MuseQA Shared TypeScript Types & Interfaces
 */

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export type BugCategory =
  | 'validation-gap'
  | 'rbac-bypass'
  | 'console-error'
  | 'network-error'
  | 'ui-crash'
  | 'visual-glitch'
  | 'accessibility'
  | 'performance'
  | 'injection'
  | 'functional'
  | 'missing-feature'
  | 'data-integrity';

export type RoleName = 'onboarding' | 'compliance' | 'approver' | 'auditor' | 'admin';

export interface Bug {
  id: string;
  fingerprint?: string;
  severity: Severity;
  category: BugCategory;
  title: string;
  description: string;
  stepsToReproduce: string[];
  expected: string;
  actual: string;
  url: string;
  role: RoleName;
  screenshotPath?: string;
  timestamp: string;
  apiEndpoint?: string;
  httpStatus?: number;
  consoleError?: string;
  fieldName?: string;
  inputValue?: string;
}

export interface KnownBug {
  id: string;
  fingerprint: string;
  title: string;
  category: BugCategory;
  urlPattern: string;
  role: RoleName;
  fieldName?: string;
  foundDate: string;
  status: 'open' | 'potentially-fixed';
  notReproducedSince?: string;
}

export interface SuppressionRule {
  id: string;
  reason: string;
  addedBy: string;
  addedDate: string;
  match: {
    category?: BugCategory;
    urlPattern?: string;
    httpStatus?: number;
    fieldName?: string;
    consoleMessagePattern?: string;
  };
}

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'textarea'
  | 'password'
  | 'hidden'
  | 'url'
  | 'unknown';

export interface FormField {
  name: string;
  type: FieldType;
  selector: string;
  required: boolean;
  currentValue: string;
  placeholder: string;
  label: string;
  maxLength?: number;
  minLength?: number;
}

export interface FormInfo {
  selector: string;
  fields: FormField[];
  submitButton?: string;
  action?: string;
}

export interface NetworkError {
  url: string;
  method: string;
  status: number;
  statusText: string;
  responseBody?: string;
}

export interface DiscoveredEndpoint {
  url: string;
  method: string;
  status: number;
  role: RoleName;
  requestHeaders?: Record<string, string>;
  responseStatus?: number;
  responseBody?: any;
}

export interface PageNode {
  url: string;
  path: string;
  title: string;
  linksFound: string[];
  formsFound: FormInfo[];
  visited: boolean;
  screenshotPath?: string;
  loadTimeMs: number;
  consoleErrors: string[];
  networkErrors: NetworkError[];
}

export interface ExplorationResult {
  role: RoleName;
  pagesVisited: number;
  formsFound: number;
  formsFuzzed: number;
  apisDiscovered: number;
  apisProbed: number;
  bugsFound: Bug[];
  durationMs: number;
  pageGraph: PageNode[];
}

export interface RoleCredentials {
  username: string;
  password: string;
  totpSecret: string;
  displayName: string;
  enabled?: boolean;
}

export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

export interface AgentConfig {
  baseURL: string;
  apiBase: string;
  roles: Record<RoleName, RoleCredentials>;
  exploration: {
    maxPagesPerRole: number;
    maxDepth: number;
    pageTimeoutMs: number;
    formFuzzTimeoutMs: number;
    totalTimeoutMs: number;
    screenshotOnEveryPage: boolean;
    headless: boolean;
  };
  features: {
    formFuzzing: boolean;
    apiProbing: boolean;
    accessibilityScan: boolean;
    mobileViewport: boolean;
    runComparison: boolean;
    notifications: boolean;
  };
  mobile: {
    viewports: ViewportConfig[];
    pagesToTest: string[];
  };
  notifications?: {
    webhookUrl: string;
    platform: 'slack' | 'teams';
    mentionOnCritical: boolean;
    quietIfNoNewBugs: boolean;
    quietDays: string[];
  };
  history: {
    retentionRuns: number;
    outputDir: string;
  };
  retry: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
}

export interface RunDiff {
  previousRunId?: string;
  newBugs: Bug[];
  fixedBugs: KnownBug[];
  ongoingBugs: Bug[];
}

export interface AgentRunSummary {
  runId: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  targetUrl: string;
  rolesExplored: RoleName[];
  totalPagesVisited: number;
  totalFormsFound: number;
  totalFormsFuzzed: number;
  totalApisDiscovered: number;
  totalBugsFound: number;
  newBugsCount: number;
  fixedBugsCount: number;
  bugsBySeverity: Record<Severity, number>;
  bugsByCategory: Record<string, number>;
  bugsByRole: Record<RoleName, number>;
  bugs: Bug[];
  explorations: ExplorationResult[];
  diff?: RunDiff;
}
