# 🔄 QiPlus End-to-End Regression Test Suite Specification

> **Comprehensive Reference & Execution Guide**  
> **Target Application**: QiPlus Merchant Onboarding & Lifecycle Platform (`https://idms-uat.qiplus.ae`)  
> **Framework**: Playwright + TypeScript + Allure 2 Report Engine  
> **Execution Strategy**: Consolidated Single-Tab Session Switching + Modular Multi-Spec Regression

---

## 📑 Table of Contents

1. [Executive Summary & Core Objectives](#1-executive-summary--core-objectives)
2. [Regression Architecture & Single-Tab Session Engine](#2-regression-architecture--single-tab-session-engine)
3. [End-to-End Consolidated Pipeline Flow](#3-end-to-end-consolidated-pipeline-flow)
4. [Detailed Phase-by-Phase Verification Matrix](#4-detailed-phase-by-phase-verification-matrix)
   - [Phase 1: Onboarding Wizard (Steps 1 – 8) & Edge Checks](#phase-1-onboarding-wizard-steps-1--8--edge-checks)
   - [Phase 2: Compliance Verification & Document Audit](#phase-2-compliance-verification--document-audit)
   - [Phase 3: Final Approval & Merchant Activation](#phase-3-final-approval--merchant-activation)
   - [Phase 4: Dashboard KPI & Table Reconciliation](#phase-4-dashboard-kpi--table-reconciliation)
5. [Regression Test Suite Files Structure](#5-regression-test-suite-files-structure)
6. [Regression State Serialization Engine](#6-regression-state-serialization-engine)
7. [Execution Commands & Troubleshooting](#7-execution-commands--troubleshooting)

---

## 1. Executive Summary & Core Objectives

The **QiPlus Regression Suite** ensures continuous software quality and guards against regressions across releases. It validates data integrity, business rules, edge cases, cross-role session transitions, and database state across the full merchant onboarding and approval lifecycle.

### 🎯 Primary Regression Objectives:
1. **Cross-Role Continuity**: Asserts that merchant dossiers submitted by Onboarding Officers (`Sukesh`) flow seamlessly into Compliance Verification (`bhanu`) and Final Approval (`uttamnadh`) without field degradation or missing attachments.
2. **Single-Tab Multi-Session Authentication**: Executes sequential role handoffs in the exact same browser tab using authenticated cookie and storage flushing (`loginAsRoleInSameTab`).
3. **Data Loss & Trimming Prevention**: Verifies whitespace auto-trimming, multi-card state persistence (Shareholders, UBOs, Signatories), and document attachment counters.
4. **KPI Dashboard Reconciliation**: Verifies that metrics on the Executive KPI Dashboard accurately match backend table records in real time.

---

## 2. Regression Architecture & Single-Tab Session Engine

To emulate realistic user journeys and avoid session collision between roles, the regression runner employs an isolated session switcher:

```typescript
/** Helper: Cleanly log in as a specified role within the SAME single browser tab */
async function loginAsRoleInSameTab(page: Page, role: { username: string; password: string }) {
  await page.context().clearCookies();
  await page.goto('https://idms-uat.qiplus.ae/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
  }).catch(() => {});
  await page.goto('https://idms-uat.qiplus.ae/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="username"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.fill('input[name="username"]', role.username);
  await page.fill('input[name="password"]', role.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
}
```

---

## 3. End-to-End Consolidated Pipeline Flow

```mermaid
flowchart TD
    subgraph Phase 1: Onboarding Officer (Sukesh)
        A[Login as Sukesh] --> B[Step 1: Test Validation & Trimmed Trade Name]
        B --> C[Step 2: Enter Turnover AED 500k & Vol 100]
        C --> D[Step 3: Shareholder 100% Boundary]
        D --> E[Step 4: UBO 25% Ownership Boundary]
        E --> F[Step 5: Signatory Full Authority]
        F --> G[Step 6: Settlement IBAN & SWIFT]
        G --> H[Step 7: Fast Batch Upload 11 Documents]
        H --> I[Step 8: Accept Declarations & Submit]
        I --> J[Capture MRN & Save to Regression State]
    end

    subgraph Phase 2: Compliance Officer (bhanu)
        J --> K[Switch Tab Session to bhanu]
        K --> L[Open Verification Queue & Filter strictly by MRN]
        L --> M[Audit Captured Profile & 11 Documents]
        M --> N[Input Mandatory Decision Notes & Approve]
        N --> O[Verify Status: Pending final approval]
    end

    subgraph Phase 3: Final Approver (uttamnadh)
        O --> P[Switch Tab Session to uttamnadh]
        P --> Q[Open Approval Queue & Search MRN]
        Q --> R[Review Compliance Notes & Risk Score]
        R --> S[Submit Decision Notes & Click Activate]
        S --> T[Verify Status: Active in Approved Merchants]
    end

    subgraph Phase 4: KPI Dashboard Audit
        T --> U[Inspect KPI Dashboard Total / Pending / Active Tiles]
        U --> V[Assert Tile Counts Match Live Table Row Counts]
    end
```

---

## 4. Detailed Phase-by-Phase Verification Matrix

---

### Phase 1: Onboarding Wizard (Steps 1 – 8) & Edge Checks
**Spec**: `tests/regression/01-onboarding-wizard.spec.ts` & `tests/regression/regression-e2e.spec.ts`  
**Role**: Onboarding Officer (`Sukesh` / `Qa@12345`)

| Step | Verification Area | Injected Edge Check / Test Condition | Expected Assertion |
|:---|:---|:---|:---|
| **Step 1 (Profile)** | Validation Triggers | Blank trade name & invalid TRN (`12345`) tested before valid data | `Save & continue` blocked until valid 15-digit Luhn TRN entered |
| **Step 1 (Profile)** | Whitespace Trimming | Trade name entered with padded spaces: `"  Apex Trading  "` | Saved value auto-trimmed to `"Apex Trading"` in review summary |
| **Step 1 (Profile)** | MRN Generation | Reads registration number from header | Unique 14-digit MRN generated and stored to `regression-state.json` |
| **Step 2 (Business)**| Turnover & Volume | Expected volume `500,000 AED`, Count `100`, Average ticket `5,000` | Values saved without numeric overflow or formatting errors |
| **Step 3 (Ownership)**| Dual Shareholder & 100% Boundary| Dual Structure: Individual (50%) + Entity (50%) in SAME record. Temporary 10% 3rd shareholder added (110%) testing exceeding boundary error, then deleted | `Total: 100.00%` restored cleanly; validates dynamic card deletion & cumulative limit |
| **Step 4 (UBOs)** | Basis of Control Matrix | Tested: Ownership (24% fail / 25% pass), Management (blank % pass), Voting (blank % pass), Stale error cleanup | Accepts $\ge 25\%$ within 100% maximum cumulative limit; at least 1 UBO present |
| **Step 5 (Signatories)**| Full Signing Scope | Authorized Signatory configured with Sole Authority & primary flag | Validated and saved to signatory register |
| **Step 6 (Banking)** | Domestic Settlement | Verified 23-char UAE IBAN (`AE52...`) + SWIFT (`EBILAEADXXX`) | Account holder name formatted as text string, saved cleanly |
| **Step 7 (Documents)**| Batch Document Upload | Fast upload of mandatory documents + View Doc preview modal validation | Fast completion, modal preview opens and closes cleanly |
| **Step 8 (Review)** | Submission & Cross-Step Checks | Accepts Declarations; validates review data parity against entered payload | Status transitions to `"Submitted for review"`, removed from Drafts |

---

### Phase 2: Compliance Verification & eMcREY Screening Audit
**Spec**: `tests/regression/02-compliance-review.spec.ts` & `tests/regression/regression-e2e.spec.ts`  
**Role**: Compliance Officer (`bhanu` / `Qa@123456789`)

| Test Scenario | Action Performed | Validation Criteria |
|:---|:---|:---|
| **Queue Search & Isolation** | Filter Verification Queue strictly by shared `MRN` | Table filters to exact row matching the MRN (no false row fallbacks) |
| **Dossier Audit** | Open merchant record | Verifies trade name and profile details display accurate captured data |
| **Approval Transition** | Input decision notes, click `"Approve & forward"`, confirm modal | Verifies toast: `"Decision recorded: Approve & forward."` confirming async screening dispatch |
| **eMcREY AML Screening Polling** | Navigate to **Approved** section; refresh >5 times (up to 10 cycles, 5s delay) | Record appears in Compliance Approved table once eMcREY screening finishes (CLEAR/HIT) |

---

### Phase 3: Final Approval, Screening Re-check & Merchant Activation
**Spec**: `tests/regression/03-final-approval.spec.ts` & `tests/regression/regression-e2e.spec.ts`  
**Role**: Final Approver (`uttamnadh` / `Qa@123456789`)

| Test Scenario | Action Performed | Validation Criteria |
|:---|:---|:---|
| **Approval Queue Polling** | Search MRN in Approval Queue with retry loop (up to 10 attempts, 5s delay) | MRN appears with status `Pending final approval` once eMcREY screening completes |
| **eMcREY Screening Re-check** | Open merchant detail dossier; locate `"Re-check screening result"` button | Clicks button to query live eMcREY screening engine status; logs result (CLEAR/HIT/Risk) |
| **Activation Execution** | Enter approval notes & click `"Approve & Activate"`, confirm dialog | Merchant approval recorded; status moves to `Active` |
| **Active Status Reconciliation** | Search MRN in **Merchant Search** directory (`/merchants/search`) / Approved list | Status chip displays **`Active`** badge |

---

### Phase 4: Dashboard KPI & Table Reconciliation
**Spec**: `tests/regression/regression-e2e.spec.ts`  
**Role**: Executive / Approver (`uttamnadh`)

| Dashboard KPI Tile | Verification Target | Expected Reconciliation |
|:---|:---|:---|
| **Total Merchants Tile** | Sum of all registrations in system | Tile count matches total rows in backend master table |
| **Pending Approval Tile** | Active records awaiting Final Approver | Tile count strictly matches active rows in Approval Queue |
| **Approved / Active Tile** | Active merchant registrations | Tile count matches count of merchants with `Active` status |

---

## 5. Regression Test Suite Files Structure

```
tests/regression/
├── regression-e2e.spec.ts          # Master single-tab regression pipeline across all 3 roles (End-to-End)
├── 01-onboarding-wizard.spec.ts    # Standalone regression spec for Onboarding Officer walkthrough
├── 02-compliance-review.spec.ts    # Standalone regression spec for Compliance Officer verification
└── 03-final-approval.spec.ts       # Standalone regression spec for Final Approver activation & KPIs
```

---

## 6. Regression State Serialization Engine

The regression suite maintains state across standalone specs via serialized JSON (`fixtures/regression-state.ts`):

```typescript
export interface RegressionState {
  mrn: string;
  submitted: boolean;
  complianceApproved: boolean;
  finalApproved: boolean;
}
```

- When `01-onboarding-wizard.spec.ts` runs, it generates and persists `mrn`.
- `02-compliance-review.spec.ts` reads the persisted `mrn` and marks `complianceApproved: true`.
- `03-final-approval.spec.ts` reads `mrn` and validates final activation.
- `regression-e2e.spec.ts` executes all 3 phases in a single seamless session.

---

## 7. Execution Commands & Troubleshooting

### 🚀 Standard Execution Commands

```powershell
# 1. Run consolidated single-tab end-to-end regression pipeline
npx playwright test tests/regression/regression-e2e.spec.ts

# 2. Run consolidated regression in headed mode (Watch live session switching)
npx playwright test tests/regression/regression-e2e.spec.ts --headed

# 3. Run all regression test files
npx playwright test tests/regression/

# 4. Run standalone compliance review regression spec
npx playwright test tests/regression/02-compliance-review.spec.ts --headed

# 5. Run standalone final approval regression spec
npx playwright test tests/regression/03-final-approval.spec.ts --headed

# 6. Generate and open Allure HTML Report with historical trends
npm run allure:generate
npm run allure:open
```

### 🔧 Troubleshooting:
- If a session switch hangs on `/login`, verify that `loginAsRoleInSameTab` successfully clears local/session storage before navigating.
- Ensure all 3 user roles (`Sukesh`, `bhanu`, `uttamnadh`) have valid active credentials in `fixtures/merchant-data.ts`.
- When running in CI/CD, execute with `workers: 1` to guarantee linear pipeline execution.

