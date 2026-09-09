# QiPlus E2E UI Test Automation Suite

A robust, enterprise-grade End-to-End (E2E) Test Automation Framework built with **Playwright (TypeScript)**, **Page Object Model (POM)**, and **Allure Reporting** for the QiPlus Merchant Onboarding & Lifecycle Management Platform.

---

## Table of Contents

- [Overview & Architecture](#overview--architecture)
- [Project Directory Structure](#project-directory-structure)
- [User Roles & Credentials](#user-roles--credentials)
- [Test Suites Breakdown](#test-suites-breakdown)
  - [1. Positive Happy Path Suite](#1-positive-happy-path-suite)
  - [2. Negative & Security Test Suite](#2-negative--security-test-suite)
  - [3. Regression Suite](#3-regression-suite)
- [Dynamic Test Data Generation](#dynamic-test-data-generation)
- [Running Tests](#running-tests)
- [Reports & Diagnostics](#reports--diagnostics)
  - [Allure Interactive Dashboard](#allure-interactive-dashboard)
  - [Playwright HTML Report](#playwright-html-report)
  - [Diagnostic Failure Triage](#diagnostic-failure-triage)
- [Key Design Decisions & Best Practices](#key-design-decisions--best-practices)

---

## Overview & Architecture

The QiPlus E2E suite automates the complete merchant onboarding lifecycle across **3 distinct user roles**:
1. **Onboarding Officer** (`Sukesh`): Initiates registration, fills all 8 wizard steps, uploads documents, and submits.
2. **Compliance Officer** (`bhanu`): Audits submitted records in Verification Queue, inputs decision notes, and approves/forwards.
3. **Final Approver** (`uttamnadh`): Inspects approved records in Approval Queue, inputs decision notes, and activates the merchant.

```mermaid
flowchart LR
    A[Onboarding Officer\nSukesh] -->|Create & Fill Steps 1-8| B[Submitted Queue\nStatus: Submitted]
    B -->|Audit & Decision Notes| C[Compliance Officer\nbhanu]
    C -->|Approve & Forward| D[Approval Queue\nStatus: Pending Final Approval]
    D -->|Audit & Decision Notes| E[Final Approver\nuttamnadh]
    E -->|Approve & Activate| F[Active Merchant\nStatus: Active]
```

---

## Project Directory Structure

```text
qiplus-e2e/
├── fixtures/                      # Test data, Luhn generators, and diagnostics
│   ├── diagnostics.ts             # Diagnostic fixture capturing console/network errors on failure
│   ├── draft-record.ts            # Draft record setup helpers
│   ├── merchant-data.ts           # Merchant templates, role credentials, state management
│   ├── state.json                 # Shared pipeline state across sequential test runs
│   ├── test-data.ts               # Dynamic Luhn algorithm generators (TRN, Emirates ID, Names)
│   ├── test-doc.pdf               # Sample PDF fixture for VAT document uploads
│   └── dummy_1.png .. dummy_11.png# Sample PNG fixtures for Step 7 mandatory uploads
├── pages/                         # Page Object Model (POM) layer
│   ├── approval-queue.page.ts     # Final Approver queue & actions
│   ├── compliance-queue.page.ts   # Compliance verification queue & review actions
│   ├── dashboard-kpi.page.ts      # Dashboard metrics & status cards
│   ├── dashboard.page.ts          # Main dashboard navigation & role verification
│   ├── login.page.ts              # Authentication & login screen
│   └── wizard/                    # 8-Step Merchant Onboarding Wizard POMs
│       ├── base-wizard.page.ts    # Base class (step navigation, DatePicker, Select helpers)
│       ├── step1-profile.page.ts  # Step 1: Legal Profile & Address
│       ├── step2-business.page.ts # Step 2: Business details & Volumes
│       ├── step3-ownership.page.ts# Step 3: Shareholders (100% boundary)
│       ├── step4-ubos.page.ts     # Step 4: UBOs & 25% ownership basis
│       ├── step5-signatories.page.ts # Step 5: Authorized Signatories
│       ├── step6-banking.page.ts  # Step 6: Banking & IBAN
│       ├── step7-documents.page.ts# Step 7: Batch Document Uploads
│       └── step8-review.page.ts   # Step 8: Data Integrity Summary & Submission
├── tests/                         # Test specs
│   ├── positive/                  # Positive Happy Path Sequential Suite
│   │   ├── 02-onboarding-wizard.spec.ts
│   │   ├── 03-compliance-review.spec.ts
│   │   ├── 04-final-approval.spec.ts
│   │   └── 05-status-transitions.spec.ts
│   ├── negative/                  # Negative, Boundary, and Security Suite
│   │   ├── 01-08-negative-onboarding.spec.ts
│   │   ├── 01-step1-profile.spec.ts .. 08-step8-review.spec.ts
│   │   ├── 09-compliance-review.spec.ts
│   │   ├── 10-final-approval.spec.ts
│   │   └── field-validation.helper.ts
│   └── regression/                # Regression End-to-End Suite
├── global-setup.ts                # Global setup to clean old Allure results per run
├── package.json                   # Dependencies and npm scripts
├── playwright.config.ts           # Central Playwright & Allure configuration
└── tsconfig.json                  # TypeScript compiler options
```

---

## User Roles & Credentials

| Role | Username | Password | Role Label | Scope |
|:---|:---|:---|:---|:---|
| **Onboarding Officer** | `Sukesh` | `Qa@12345` | `Onboarding officer` | Creates records, fills Steps 1–8, submits |
| **Compliance Officer** | `bhanu` | `Qa@123456789` | `Compliance officer` | Audits submitted records, approves/holds/rejects |
| **Final Approver** | `uttamnadh` | `Qa@123456789` | `Final approver` | Grants final approval, activates merchant |

---

## Test Suites Breakdown

### 1. Positive Happy Path Suite (`tests/positive/`)

Executed sequentially using a single worker (`workers: 1`, `fullyParallel: false`) to preserve pipeline state:

1. **`02-onboarding-wizard.spec.ts`**:
   - Generates fresh dynamic record (unique company name, valid TRN, valid Emirates ID).
   - Fills all 8 wizard steps sequentially.
   - Uploads all 11 mandatory documents in Step 7 in ultra-fast batch mode (~4.5s).
   - Submits record on Step 8 and verifies presence in `Submitted` queue.
   - Saves record state (`mrn`, `submitted = true`).
2. **`03-compliance-review.spec.ts`**:
   - Logs in as `bhanu`.
   - Filters Verification Queue strictly by the created `MRN` (no fallback).
   - Audits data, fills mandatory `Decision notes *`, clicks `Approve & forward`.
   - Verifies record in `Approved` list and logs out.
3. **`04-final-approval.spec.ts`**:
   - Logs in as `uttamnadh`.
   - Filters Approval Queue strictly by the approved `MRN` (no fallback).
   - Fills mandatory `Decision notes *`, clicks `Approve & Activate`.
   - Verifies status changed to `Active` in `Approved merchants` list and logs out.
4. **`05-status-transitions.spec.ts`**:
   - Multi-role audit ensuring data consistency and status badges across all 3 roles for the exact same MRN.

> **Pipeline Guarding:** If Onboarding fails at any step, `03`, `04`, and `05` automatically **skip execution completely without logging in**.

---

### 2. Negative & Security Test Suite (`tests/negative/`)

Comprehensive edge-case, boundary, and vulnerability test coverage:

- **Boundary Testing**:
  - Step 3: Total shareholding `< 100%`, `> 100%`, negative values, non-numeric values.
  - Step 4: UBO shareholding below boundary `< 25%` with Ownership basis.
- **Field Validations**:
  - Invalid / short TRN (fails Luhn check).
  - Invalid Emirates ID format.
  - Invalid IBAN / SWIFT lengths.
  - Expired / past licence issue and expiry dates.
  - Duplicate TRN validation.
- **Security & Injection Testing**:
  - XSS payloads (`<script>alert(1)</script>`, `svg onload`).
  - SQL Injection strings (`' OR 1=1 --`, `'; DROP TABLE merchants; --`).
  - Unicode and long string payload resistance (5000+ characters).
- **Workflow & Queue Negative Tests**:
  - Rejecting merchant without entering mandatory reason.
  - Holding merchant without notes.
  - Returning for clarification without comments.

---

## Dynamic Test Data & Shareholder Mode

All dynamic test data is generated via [`fixtures/test-data.ts`](file:///C:/Users/Kiran/.gemini/antigravity/scratch/qiplus-e2e/fixtures/test-data.ts) and [`fixtures/merchant-data.ts`](file:///C:/Users/Kiran/.gemini/antigravity/scratch/qiplus-e2e/fixtures/merchant-data.ts):

- **Company Names**: Combines dynamic prefixes & industries (e.g. `Summit Trading 4829 LLC`, `Emerald Ventures 9123 LLC`).
- **TRN**: 15-digit numeric string beginning with `100` satisfying the **Luhn Checksum Algorithm**.
- **Emirates ID**: 15-digit string formatted as `784-1992-XXXXXXX-Z` satisfying the **Luhn Checksum Algorithm**.
- **Shareholder Choices (Step 3 & 4)**:
  - **`Individual`**: Selects `Individual`, fills `Emirates ID` (or `Passport`), auto carries forward to Step 4 UBO.
  - **`Entity`**: Selects `Entity`, checks `Trade License` radio, fills `Trade Licence number` (`TL162770`). UBO in Step 4 is **not** carried forward and is filled manually with complete natural person KYC details.

---

## Running Tests

### 1. Interactive Terminal Batch Runner (Prompt for Records Count & Entity / Individual)
```powershell
npm run wizard
```
*or*
```powershell
node run-wizard.js
```
> Prompts interactively in the terminal for:
> 1. **Shareholder Type**: `[1] Individual`, `[2] Entity`, or `[3] Alternate (Mix)`
> 2. **Number of Records to Create**: `1, 2, 3, 5, 10+`
> 3. **Browser Mode**: `[1] Headed` or `[2] Headless`
> 
> Automatically creates each merchant, fills all 8 wizard steps, uploads documents, submits, and prints a **Consolidated Batch Summary Table** of all generated MRNs upon completion.

### 2. Direct Playwright Run (With Console Prompt)
```powershell
npx playwright test tests/positive/02-onboarding-wizard.spec.ts --headed --reporter=list
```

### 3. Test a Specific Existing Draft MRN
```powershell
npx playwright test tests/positive/test-draft-mrn.spec.ts --headed
```

### 4. Run Complete Positive Pipeline
```powershell
npx playwright test tests/positive/
```

### 5. Run Negative Suite
```powershell
npx playwright test tests/negative/
```

---

## Reports & Diagnostics

### Allure Interactive Dashboard

Allure results are automatically generated in `allure-results/` on every test run.

To view the live dashboard in your default browser:
```powershell
npm run allure:serve
```

To generate a standalone static report folder (`allure-report/`):
```powershell
npm run allure:generate
npm run allure:open
```

---

### Playwright HTML Report

Playwright generates an out-of-the-box HTML report with traces, videos, and DOM snapshots:
```powershell
npx playwright show-report
```

---

### Diagnostic Failure Triage

When a test fails, [`fixtures/diagnostics.ts`](file:///C:/Users/Kiran/.gemini/antigravity/scratch/qiplus-e2e/fixtures/diagnostics.ts) automatically classifies the root cause and attaches raw logs:

- **`failed-network-responses.json`** has entries $\rightarrow$ **Backend Bug** (API returned 4xx/5xx).
- **`console-errors.json`** / **`page-errors.json`** has entries $\rightarrow$ **Frontend Bug** (JS browser exception).
- All empty $\rightarrow$ **Script / Locator issue** (Inspect DOM trace).

---

## Key Design Decisions & Best Practices

1. **Deterministic Sequential Execution**: Single worker (`workers: 1`, `fullyParallel: false`) ensures state passed from Onboarding $\rightarrow$ Compliance $\rightarrow$ Approver is preserved without race conditions.
2. **Strict MRN Isolation**: Every test run creates a fresh MRN. Downstream queues filter strictly by that MRN to avoid picking up old or incomplete database records.
3. **MUI DatePicker Handling**: Uses keyboard typing with `Escape` dismissals to prevent MUI Calendar Popups from capturing focus and dropping keystrokes.
4. **Auto-Clean Cache**: [`global-setup.ts`](file:///C:/Users/Kiran/.gemini/antigravity/scratch/qiplus-e2e/global-setup.ts) cleans old Allure results once before test execution starts, ensuring reports always display fresh data.
