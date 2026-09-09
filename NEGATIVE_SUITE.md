# 🛡️ QiPlus Negative, Boundary & Security Test Suite Specification

> **Comprehensive Reference & Execution Guide**  
> **Target Application**: QiPlus Merchant Onboarding & Lifecycle Platform (`https://idms-uat.qiplus.ae`)  
> **Framework**: Playwright + TypeScript + Allure 2 Report Engine  
> **Total Test Cases**: **143+ Distinct Scenarios** across 8 Wizard Steps + 2 Reviewer Queues

---

## 📑 Table of Contents

1. [Executive Summary & Core Principles](#1-executive-summary--core-principles)
2. [Test Architecture & Execution Strategy](#2-test-architecture--execution-strategy)
3. [Master Negative Validation Matrix (Steps 1 – 8)](#3-master-negative-validation-matrix-steps-1--8)
   - [Step 1: Merchant Profile & Primary Contact (30 Scenarios)](#step-1-merchant-profile--primary-contact)
   - [Step 2: Business Activities & Processing Volumes (12 Scenarios)](#step-2-business-activities--processing-volumes)
   - [Step 3: Shareholder & Ownership Structure (11 Scenarios)](#step-3-shareholder--ownership-structure)
   - [Step 4: Ultimate Beneficial Owners - UBOs (26 Scenarios)](#step-4-ultimate-beneficial-owners--ubos)
   - [Step 5: Authorized Signatories & Authority (10 Scenarios)](#step-5-authorized-signatories--authority)
   - [Step 6: Settlement Banking & IBAN Rules (18 Scenarios)](#step-6-settlement-banking--iban-rules)
   - [Step 7: Supporting Document Uploads (10 Scenarios)](#step-7-supporting-document-uploads)
   - [Step 8: Final Review & Submission Locks (16 Scenarios)](#step-8-final-review--submission-locks)
4. [Reviewer & Approver Workflow Negative Tests](#4-reviewer--approver-workflow-negative-tests)
   - [Step 9: Compliance Officer Verification Queue (5 Scenarios)](#step-9-compliance-officer-verification-queue)
   - [Step 10: Final Approver & Activation Queue (6 Scenarios)](#step-10-final-approver--activation-queue)
5. [Security & Injection Vulnerability Matrix](#5-security--injection-vulnerability-matrix)
6. [UAE Regulatory & Financial Format Reference](#6-uae-regulatory--financial-format-reference)
7. [Execution Commands & Troubleshooting](#7-execution-commands--troubleshooting)

---

## 1. Executive Summary & Core Principles

The **QiPlus Negative Test Suite** rigorously validates the resilience, compliance, and security posture of the merchant onboarding lifecycle. It ensures that invalid data formats, boundary violations, malicious injection payloads, unauthorized actions, and incomplete submissions are intercepted and rejected at the client and server layers.

### 🔑 Key Invariants & Rules:
1. **Zero Draft Pollution**: Negative assertions mutate fields in-memory and assert UI blocking / validation errors, but **NEVER click "Save Draft" or "Save & continue" with invalid data**.
2. **State Restoration**: Every test case follows an atomic `Action → Assert → Restore` lifecycle, returning the active wizard card to a clean baseline state.
3. **Draft Record Reuse / Targeted Resumption**: Tests can run on a designated draft MRN (e.g., `2026000957`) or on a freshly spawned registration without corrupting existing records.
4. **Single-Page Isolation**: In multi-scenario step runs, all scenarios execute sequentially inside a single page session without unnecessary page reloads.

---

## 2. Test Architecture & Execution Strategy

```
tests/negative/
├── 01-08-negative-onboarding.spec.ts   # Unified master suite covering Steps 1 to 8 (133 field scenarios)
├── 09-compliance-review.spec.ts        # Compliance officer review negative checks & queue transitions
├── 10-final-approval.spec.ts           # Final approver negative checks & KPI reconciliation
└── field-validation.helper.ts          # Core runner: runFieldMatrix, navigateToWizardStep, assertions
```

---

## 3. Master Negative Validation Matrix (Steps 1 – 8)

---

### Step 1: Merchant Profile & Primary Contact
**Spec**: `Step 1 - Profile` | **Total Scenarios**: 30

| # | Field Name | Validation Rule | Test Input / Payload | Expected UI Behavior |
|:---|:---|:---|:---|:---|
| 1 | **Merchant / Trade Name** | Required Field | `""` (Blank) | Error: `"Trade name is required"`; Save disabled |
| 2 | **Merchant / Trade Name** | Minimum Length | `"A"` (1 character) | Error: `"Minimum 2 characters required"` |
| 3 | **Merchant / Trade Name** | Maximum Length | 151+ characters | Input truncated or error: `"Maximum 150 characters"` |
| 4 | **Merchant / Trade Name** | XSS Script Tag | `<script>alert('XSS')</script>` | Sanitized / HTML escaped; no DOM script execution |
| 5 | **Merchant / Trade Name** | SQL Injection | `' OR '1'='1` | Stored as literal string without SQL syntax error |
| 6 | **Legal Name** | Required Field | `""` (Blank) | Error: `"Legal name is required"`; Save disabled |
| 7 | **Legal Name** | Maximum Length | 151+ characters | Input truncated or error: `"Maximum 150 characters"` |
| 8 | **Legal Name** | XSS Image Payload | `<img src=x onerror=alert(1)>` | Escaped as raw text; no broken image/script alert |
| 9 | **Tax Registration (TRN)** | Required Field | `""` (Blank) | Error: `"TRN is required"` |
| 10 | **Tax Registration (TRN)** | Length Check | `"100123456789"` (12 digits) | Error: `"TRN must be exactly 15 digits"` |
| 11 | **Tax Registration (TRN)** | Numeric Format | `"10034567891234A"` (Alpha) | Non-numeric characters rejected |
| 12 | **Tax Registration (TRN)** | Prefix Format | `"200123456789012"` (Non-100) | Error: `"UAE TRN must start with 100"` |
| 13 | **Tax Registration (TRN)** | Luhn Checksum | `"100123456789010"` (Invalid Luhn) | Error: `"Invalid TRN check digit"` |
| 14 | **Licence Number** | Required Field | `""` (Blank) | Error: `"Trade licence number is required"` |
| 15 | **Licence Number** | SQL Injection | `'; DROP TABLE merchants;--` | Escaped; no database command execution |
| 16 | **Licence Issue Date** | Required Field | `""` (Blank) | Error: `"Issue date is required"` |
| 17 | **Licence Issue Date** | Future Date | Tomorrow's date | Error: `"Issue date cannot be in the future"` |
| 18 | **Licence Expiry Date** | Required Field | `""` (Blank) | Error: `"Expiry date is required"` |
| 19 | **Licence Expiry Date** | Past Date | Yesterday's date | Error: `"Licence has expired / Expiry must be future"` |
| 20 | **Business Activities** | Minimum Selection | Uncheck all activities | Error: `"Select at least one business activity"` |
| 21 | **Address Line 1** | Required Field | `""` (Blank) | Error: `"Building / Street is required"` |
| 22 | **Address Line 1** | Maximum Length | 255+ characters | Input capped at max length |
| 23 | **City / Emirate** | Required Dropdown | None selected | Error: `"Emirate selection is required"` |
| 24 | **Country** | UAE Fixed Constraint | Select non-UAE country | Error / Reset to `"United Arab Emirates"` |
| 25 | **PO Box / Postal Code** | Format Check | `"!@#$%"` | Error: `"Invalid PO Box format"` |
| 26 | **Primary Contact Phone**| Required Field | `""` (Blank) | Error: `"Phone number is required"` |
| 27 | **Primary Contact Phone**| UAE Mobile Format | `"050123"` (Incomplete) | Error: `"Enter valid 9-digit UAE phone number"` |
| 28 | **Primary Contact Email**| Required Field | `""` (Blank) | Error: `"Email is required"` |
| 29 | **Primary Contact Email**| Invalid Format | `"invalid-email.com"` (No `@`) | Error: `"Enter a valid email address"` |
| 30 | **Primary Contact Email**| Incomplete Domain | `"user@domain"` (No TLD) | Error: `"Enter a valid email address"` |

---

### Step 2: Business Activities & Processing Volumes
**Spec**: `Step 2 - Business` | **Total Scenarios**: 12

| # | Field Name | Validation Rule | Test Input / Payload | Expected UI Behavior |
|:---|:---|:---|:---|:---|
| 1 | **Merchant Category Code**| Required Field | Unselected / Blank | Error: `"MCC is required"`; Save disabled |
| 2 | **Business Description** | Required Field | `""` (Blank) | Error: `"Description is required"` |
| 3 | **Business Description** | Minimum Length | `"Shop"` (< 10 chars) | Error: `"Description must be at least 10 characters"` |
| 4 | **Business Description** | XSS Payload | `<script>document.cookie</script>`| Escaped safely in description text area |
| 5 | **Monthly Turnover (AED)** | Required Field | `""` (Blank) | Error: `"Expected turnover is required"` |
| 6 | **Monthly Turnover (AED)** | Positive Number | `"-50000"` (Negative) | Error: `"Turnover must be a positive number"` |
| 7 | **Monthly Turnover (AED)** | Zero Boundary | `"0"` | Error: `"Turnover must be greater than 0"` |
| 8 | **Monthly Transaction Count**| Required Field | `""` (Blank) | Error: `"Transaction count is required"` |
| 9 | **Monthly Transaction Count**| Non-Numeric | `"Ten Thousand"` | Error: `"Numeric digits only"` |
| 10 | **Average Ticket Size** | Boundary Check | Exceeds monthly turnover | Error / Warning: `"Average ticket cannot exceed volume"`|
| 11 | **Website / App URL** | Protocol Scheme | `"ftp://myshop.com"` | Error: `"URL must start with http:// or https://"` |
| 12 | **Operating Model** | Required Selection | None selected | Error: `"Select an operating model"` |

---

##### Step 3: Corporate Ownership & Shareholders
**Spec**: `Step 3 - Ownership` | **Total Scenarios**: 11

> **Business Rule (25% UBO Linkage)**: Any individual shareholder holding **25% or more** must also be captured as a UBO in Step 4. Step 4 will automatically carry forward the shareholder's identity details.

| # | Field Name | Validation Rule | Test Input / Payload | Expected UI Behavior |
|:---|:---|:---|:---|:---|
| 1 | **Entity / Shareholder Name**| Required Field | `""` (Blank) | Error: `"Shareholder name is required"` |
| 2 | **Entity / Shareholder Name**| XSS Script Tag | `<svg onload=alert(1)>` | Sanitized; plain text display |
| 3 | **Registration Country** | Required Dropdown | Unselected | Error: `"Country of registration is required"` |
| 4 | **Percentage Shareholding** | Required Field | `""` (Blank) | Error: `"Shareholding percentage is required"` |
| 5 | **Percentage Shareholding** | Negative Value | `"-15"` | Error: `"Percentage cannot be negative"` |
| 6 | **Percentage Shareholding** | Zero Value | `"0"` | Error: `"Shareholding must be greater than 0%"` |
| 7 | **Percentage Shareholding** | Non-Numeric | `"TwentyFive"` | Error: `"Enter valid numeric percentage"` |
| 8 | **Percentage Shareholding** | Over 100% | `"101"` | Error: `"Individual share cannot exceed 100%"` |
| 9 | **Cumulative Shareholding** | Total Under 100% | Single shareholder at `75%` | Error: `"Total shareholding must equal exactly 100%"` |
| 10 | **Cumulative Shareholding** | Total Over 100% | 2 shareholders at `60% + 50%` (`110%`) | Error: `"Total shareholding cannot exceed 100%"` |
| 11 | **Shareholder List** | Minimum Count | Delete all shareholder cards | Error: `"At least one shareholder is required"` |

---

### Step 4: Ultimate Beneficial Owners (UBOs)
**Spec**: `Step 4 - UBOs` | **Total Scenarios**: 26

> **Business Rules**:
> 1. **Auto Carry-Forward**: Shareholders holding $\ge 25\%$ are carried forward from Step 3; remaining UBO-specific fields (DOB, Place of Birth, Country of Residence, Basis of Control, Occupation, PEP) must be completed.
> 2. **Mandatory UBO**: At least one UBO is mandatory (either carried-forward or newly added).
> 3. **Cumulative Limit**: Total cumulative UBO shareholding cannot exceed 100%.

| # | Field Name | Validation Rule | Test Input / Payload | Expected UI Behavior |
|:---|:---|:---|:---|:---|
| 1 | **UBO Full Legal Name** | Required Field | `""` (Blank) | Error: `"Full legal name is required"` |
| 2 | **UBO Full Legal Name** | XSS Payload | `<b onmouseover=alert('XSS')>UBO</b>` | Rendered as text |
| 3 | **Date of Birth** | Required Date | `""` (Blank) | Error: `"Date of birth is required"` |
| 4 | **Date of Birth** | Future Date | Tomorrow's date | Error: `"Date of birth cannot be in the future"` |
| 5 | **Date of Birth** | Underage (< 18 yrs) | Date resulting in age = 15 | Error: `"UBO must be at least 18 years old"` |
| 6 | **Place of Birth** | Required Field | `""` (Blank) | Error: `"Place of birth is required"` |
| 7 | **Nationality (Primary)** | Required Dropdown | Unselected | Error: `"Primary nationality is required"` |
| 8 | **Country of Residence** | Required Dropdown | Unselected | Error: `"Country of residence is required"` |
| 9 | **Emirates ID Number** | Required (for EID) | `""` (Blank) | Error: `"Emirates ID is required"` |
| 10 | **Emirates ID Number** | Format Mask | `"784199012345671"` (No hyphens)| Formatted / Error: `"784-YYYY-XXXXXXX-Z"` |
| 11 | **Emirates ID Number** | Country Code | `"785-1990-1234567-1"` (Not 784)| Error: `"Emirates ID must start with 784"` |
| 12 | **Emirates ID Number** | Luhn Check Digit | `"784-1990-1234567-0"` (Bad check)| Error: `"Invalid Emirates ID check digit"` |
| 13 | **ID Expiry Date** | Expiry Boundary | Yesterday's date | Error: `"ID has expired"` |
| 14 | **Basis of Control** | Required Dropdown | Unselected | Error: `"Basis of control is required"` |
| 15 | **Basis: Ownership** | Threshold Check | `< 25%` (e.g. `24.9%`) | Error: `"Ownership basis requires >= 25% shareholding"` |
| 16 | **Basis: Ownership** | Exact Boundary | `25%` | Accepted without error |
| 17 | **Basis: Ownership** | Maximum Boundary | `101%` | Error: `"Shareholding cannot exceed 100%"` |
| 18 | **Basis: Ownership** | Negative Value | `"-10%"` | Error: `"Percentage cannot be negative"` |
| 19 | **Basis: Management** | Optional % | `""` (Blank percentage) | Accepted without % requirement |
| 20 | **Basis: Voting Rights**| Threshold Check | `< 25%` | Error: `"Voting rights basis requires >= 25%"` |
| 21 | **Basis Switch** | Stale Error Check | Switch Ownership (20% err) $\rightarrow$ Management | Error clears automatically on switch |
| 22 | **Occupation** | Required Field | `""` (Blank) | Error: `"Occupation is required"` |
| 23 | **PEP Checkbox** | Boolean Toggle | Checked / Unchecked | State toggles cleanly without crashing form |
| 24 | **Dual Nationality** | Optional Field | Checkbox unchecked | Secondary nationality combobox hidden |
| 25 | **Dual Nationality** | Required if Checked| Checkbox checked, input blank | Error: `"Secondary nationality is required"` |
| 26 | **UBO List Count** | Minimum Count | Delete all UBO entries | Error: `"At least one UBO must be declared"` |

---

### Step 5: Authorized Signatories & Authority
**Spec**: `Step 5 - Signatories` | **Total Scenarios**: 10

| # | Field Name | Validation Rule | Test Input / Payload | Expected UI Behavior |
|:---|:---|:---|:---|:---|
| 1 | **Signatory Name** | Required Field | `""` (Blank) | Error: `"Full name is required"` |
| 2 | **Signatory Name** | XSS Payload | `<script>alert(1)</script>` | Escaped text representation |
| 3 | **Designation / Role** | Required Field | `""` (Blank) | Error: `"Designation is required"` |
| 4 | **Nationality** | Required Dropdown | Unselected | Error: `"Nationality is required"` |
| 5 | **Emirates ID Number** | Format Validation | `"784-0000-0000000-0"` | Error: `"Invalid Emirates ID format / check digit"` |
| 6 | **Scope of Authority** | Required Field | `""` (Blank) | Error: `"Scope of authority is required"` |
| 7 | **Scope of Authority** | XSS Payload | `<script>alert(1)</script>` | Escaped text representation |
| 8 | **Scope of Authority** | Long Text | 200+ characters | Preserved without truncation or form crash |
| 9 | **Signatory Count** | Minimum Count | Delete all signatory cards | Error: `"At least one signatory is required"` |
| 10 | **Multiple Signatories**| Independent Save | Add second signatory card | Both signatories saved independently |

---

### Step 6: Settlement Banking & IBAN Rules
**Spec**: `Step 6 - Banking` | **Total Scenarios**: 18

| # | Field Name | Validation Rule | Test Input / Payload | Expected UI Behavior |
|:---|:---|:---|:---|:---|
| 1 | **Account Holder Name** | Required Field | `""` (Blank) | Error: `"Account holder name is required"` |
| 2 | **Account Holder Name** | Numbers in Name | `"Apex Trading 123"` | Error: `"Account holder name must contain only alphabets"` |
| 3 | **Account Holder Name** | Special Characters | `"Apex & Sons @ LLC"` | Error: `"Special characters not permitted"` |
| 4 | **Account Holder Name** | Whitespace Trimming | `"   Apex Trading   "` | Auto-trimmed to `"Apex Trading"` |
| 5 | **IBAN** | Required Field | `""` (Blank) | Error: `"IBAN is required"` |
| 6 | **IBAN Length** | UAE Format (23 chars)| `"AE0310001234"` (12 chars) | Error: `"UAE IBAN must be exactly 23 characters"` |
| 7 | **IBAN Country Code** | Non-AE Prefix | `"GB82WEST12345698765432"` | Error: `"IBAN must start with AE"` |
| 8 | **IBAN Check Digits** | Mod-97 Failure | `"AE000335305065957162693"` | Error: `"Invalid IBAN check digits"` |
| 9 | **IBAN Formatting** | Auto-Formatting | `"AE520335305065957162693"` | Visual grouping: `AE52 0335 3050 6595 7162 693` |
| 10 | **IBAN Clipboard Paste**| Raw String Paste | Paste `"AE520335305065957162693"` | Cleanly populated without duplicate prefixes |
| 11 | **Bank Name** | Auto-Population | Valid UAE IBAN entered | Bank name automatically resolves (e.g. Emirates NBD) |
| 12 | **SWIFT / BIC** | Required Field | `""` (Blank) | Error: `"SWIFT / BIC code is required"` |
| 13 | **SWIFT / BIC** | Format Check (8/11) | `"EBIL"` (4 chars) | Error: `"SWIFT code must be 8 or 11 characters"` |
| 14 | **SWIFT / BIC** | Auto-Population | Valid UAE IBAN entered | SWIFT auto-populated based on routing directory |
| 15 | **Account Currency** | Required Dropdown | Unselected | Error: `"Currency is required"`; defaults to AED |
| 16 | **Account Type** | Required Dropdown | Unselected | Error: `"Account type is required"`; defaults to Current |
| 17 | **Branch Name / Code** | Required Field | `""` (Blank) | Error: `"Branch details are required"` |
| 18 | **Bank Routing Code** | Numeric Format | `"ROUT-ABC"` | Error: `"Routing code must be numeric"` |

---

### Step 7: Supporting Document Uploads
**Spec**: `Step 7 - Documents` | **Total Scenarios**: 10

| # | Document Category | Validation Rule | Test Input / Payload | Expected UI Behavior |
|:---|:---|:---|:---|:---|
| 1 | **Trade Licence** | Mandatory Document | Missing / Not uploaded | Error: `"Trade licence document is mandatory"`; Next blocked |
| 2 | **MOA / AOA** | Mandatory Document | Missing / Not uploaded | Error: `"Memorandum of Association is mandatory"` |
| 3 | **Emirates ID (Front)** | Mandatory Document | Missing / Not uploaded | Error: `"Signatory Emirates ID is mandatory"` |
| 4 | **Bank Confirmation** | Mandatory Document | Missing / Not uploaded | Error: `"Bank statement / letter is mandatory"` |
| 5 | **File Extension Check** | Block Executables | Upload `malicious_script.exe` | Error: `"Invalid file type (.exe not permitted)"` |
| 6 | **File Extension Check** | Block Batch Files | Upload `payload.bat` | Error: `"Invalid file type (.bat not permitted)"` |
| 7 | **File Extension Check** | Block Script Files | Upload `shell.sh` | Error: `"Invalid file type (.sh not permitted)"` |
| 8 | **File Size Limit** | Oversized File | Upload `huge_archive.pdf` (25MB) | Error: `"File exceeds maximum allowed limit (15MB)"` |
| 9 | **Zero-Byte File** | Corrupt File | Upload `empty_zero_byte.pdf` | Error: `"Uploaded file is empty or corrupted"` |
| 10 | **Multi-File Upload** | Partial Upload | Upload 2 of 4 required files | Save disabled until all mandatory slots populated |

---

### Step 8: Final Review, Cross-Step Mismatch Alerts & Submission Locks
**Spec**: `Step 8 - Review` | **Total Scenarios**: 16

> **Cross-Step Resolution Rule**: If a shareholder $\ge 25\%$ was changed in Step 3 creating a mismatch with Step 4 UBOs, Step 8 displays an error popup. Clicking the popup automatically navigates the user back to Step 4 (UBOs) to resolve the mismatch.

| # | Section / Element | Validation Rule | Test Condition / Payload | Expected UI Behavior |
|:---|:---|:---|:---|:---|
| 1 | **Terms & Conditions** | Mandatory Agreement | Checkbox unchecked | `"Submit for Review"` button is **Disabled** |
| 2 | **Accuracy Declaration** | Mandatory Declaration| Checkbox unchecked | `"Submit for Review"` button is **Disabled** |
| 3 | **Incomplete Step 1** | Cross-Step Interlock | Profile missing required field | Direct jump to Step 8 blocks submission |
| 4 | **Incomplete Step 3** | Cross-Step Interlock | Ownership sum = 80% | Review page flags Step 3 error card |
| 5 | **Step 3 ↔ Step 4 UBO Mismatch**| Cross-Step Resolution | Shareholder % changed in Step 3 | Error popup shown; clicking popup navigates back to Step 4 |
| 6 | **Incomplete Step 4** | Cross-Step Interlock | UBO missing Emirates ID | Review page flags Step 4 error card |
| 7 | **Incomplete Step 6** | Cross-Step Interlock | Missing IBAN | Review page flags Step 6 error card |
| 8 | **Incomplete Step 7** | Cross-Step Interlock | Missing mandatory PDF | Review page flags Step 7 error card |
| 9 | **Data Summary Integrity** | Read-Only Summary | Attempt to edit text on Step 8 | Inputs are read-only summary labels |
| 10 | **Edit Link Navigation** | Step Redirect | Click `"Edit Profile"` link | Navigates directly back to Step 1 |
| 11 | **Submit Button State** | Valid State | All Steps 1–7 valid + Both checkboxes | `"Submit for Review"` button is **Enabled** |
| 12 | **Double Submit Block** | Idempotency | Double-click Submit button rapidly | Only 1 network submission dispatched |
| 13 | **Status Transition** | Submission Confirmation| Click `"Submit for Review"` | Status updates to `"Submitted for review"` |
| 14 | **Queue Routing** | Verification Queue | Submitted MRN verification | Record appears in Compliance Review Queue |
| 15 | **Officer Post-Submit** | Edit Lock | Attempt to edit submitted MRN | Wizard is locked in read-only mode |
| 16 | **Drafts Table Cleanup** | Queue Migration | Check Drafts table | Record removed from Drafts list | Formats strictly as `YYYYXXXXXX` (10 digits) |

---

## 4. Reviewer & Approver Workflow Negative Tests

---

### Step 9: Compliance Officer Verification Queue
**Spec**: `tests/negative/09-compliance-review.spec.ts` | **Total Scenarios**: 5

| # | Scenario Description | Officer Action | Injected Negative State | Expected Enforcement |
|:---|:---|:---|:---|:---|
| 1 | **Reject without Reason** | Click `"Reject"` button | Reason text area is empty | Blocked with inline error: `"Mandatory rejection reason required"`. Status remains `Submitted for review`. |
| 2 | **Hold without Reason** | Click `"Put on Hold"` button | Notes text area is empty | Blocked with inline error: `"Mandatory hold notes required"`. Status remains `Submitted for review`. |
| 3 | **Return for Info without Comments** | Click `"Return for Clarification"` | Comments text area is empty | Blocked with inline error: `"Comments are required when returning for info"`. Status unchanged. |
| 4 | **Return for Clarification (Valid)** | Click `"Return"` with comments | Adds comment: `"Verify UBO ID"` | Status transitions to `Returned for info`. Record reappears in Onboarding Officer's queue. |
| 5 | **Re-submission Workflow** | Officer updates & re-submits | Corrects requested field | Record returns to Compliance Verification Queue. |

---

### Step 10: Final Approver & Activation Queue
**Spec**: `tests/negative/10-final-approval.spec.ts` | **Total Scenarios**: 6

| # | Scenario Description | Approver Action | Injected Negative State | Expected Enforcement |
|:---|:---|:---|:---|:---|
| 1 | **Reject without Mandatory Reason** | Click `"Reject"` | Decision notes empty | Blocked with error: `"Approval rejection requires justification"`. Status remains `Pending final approval`. |
| 2 | **Direct URL Bypass Attempt** | Navigate to `/approval-queue/review/UNCLEARED_99` | Record not yet cleared by compliance | Access denied or redirect to `/dashboard`. Prevents unapproved activation bypass. |
| 3 | **Compliance Notes Visibility** | Inspect merchant detail view | Check notes panel | Notes recorded by Compliance Officer are visible to Final Approver before decision. |
| 4 | **Dashboard KPI Reconciliation** | Inspect KPI dashboard tiles | Compare KPI Total vs Queue | KPI `"Pending Approval"` tile count strictly matches the live table row count. |
| 5 | **Queue Filter Integrity** | Inspect approval queue table | Filter by status | Approval queue only contains records with status `Pending final approval`. |
| 6 | **Final Activation** | Click `"Approve & Activate"` | Provide approval notes | Status updates to `Active` / `Approved`. Merchant ID (MID) generated. |

---

## 5. Security & Injection Vulnerability Matrix

The test framework injects standard OWASP payloads into all text and search fields to guarantee input sanitization:

| Injection Type | Test Payloads | Target Fields | Protection Mechanism |
|:---|:---|:---|:---|
| **Stored & Reflected XSS** | `<script>alert('XSS')</script>`<br>`"><img src=x onerror=alert(1)>`<br>`<svg onload=alert(1)>`<br>`javascript:alert(1)` | Trade Name, Legal Name, Description, Address, Account Holder Name, Reason boxes | React JSX automatic HTML entity encoding + DOMPurify on rendered text |
| **SQL Injection (SQLi)** | `' OR '1'='1`<br>`' OR 1=1 --`<br>`'; DROP TABLE merchants; --`<br>`UNION SELECT 1, 'admin', 'pwd'` | MRN Search, Licence Number, TRN, SWIFT Code | Parameterized queries & ORM query sanitization on backend API |
| **Buffer Overflow & Stress** | 5,000+ repeated character strings (`A` $\times 5000$) | Description, Address Line 1, Notes text areas | Strict UI `maxlength` attributes + database column size constraints |
| **Unicode & Special Scripts** | Multi-byte Arabic (`شركة تجارية`), Emoji (`🚀🔥💰`), Cyrillic (`Тест`) | Trade Name, Description, City | UTF-8 database encoding support without corrupting table records |

---

## 6. UAE Regulatory & Financial Format Reference

```
┌────────────────────────────────────────────────────────────────────────┐
│                      UAE DATA FORMAT CHECKS MATRIX                    │
├──────────────────────┬──────────────────────┬──────────────────────────┤
│ DATA FIELD           │ FORMAT PATTERN       │ SAMPLE VALID VALUE       │
├──────────────────────┼──────────────────────┼──────────────────────────┤
│ Tax Reg. No (TRN)    │ 15 digits, starts 100│ 100 7579 1021 3176       │
│ Emirates ID (EID)    │ 784-YYYY-XXXXXXX-Z   │ 784-1992-1448568-4       │
│ UAE IBAN             │ AE + 2 digits + 19 al│ AE52 0335 3050 6595 7162 │
│ SWIFT / BIC          │ 8 or 11 characters   │ ENBDAEADXXX              │
│ UAE Mobile Phone     │ +971 5X XXX XXXX     │ +971 50 123 4567         │
│ Trade Licence No     │ 6–10 alphanumeric    │ TL-813822                │
│ Merchant Ref (MRN)   │ YYYYXXXXXX (10 digits│ 2026000957               │
└──────────────────────┴──────────────────────┴──────────────────────────┘
```

---

## 7. Execution Commands & Troubleshooting

### 🚀 Standard Execution Commands

```powershell
# 1. Run full unified negative suite (Steps 1 to 8)
npx playwright test tests/negative/01-08-negative-onboarding.spec.ts

# 2. Run targeted step validation (e.g. Step 4 UBOs only in 15 seconds)
npx playwright test tests/negative/01-08-negative-onboarding.spec.ts -g "Step 4"

# 3. Run Compliance Officer Review negative tests
npx playwright test tests/negative/09-compliance-review.spec.ts

# 4. Run Final Approver Review negative tests
npx playwright test tests/negative/10-final-approval.spec.ts

# 5. Run with headed browser for visual inspection
npx playwright test tests/negative/01-08-negative-onboarding.spec.ts -g "Step 1" --headed

# 6. Generate and open Allure HTML Report with trends
npm run allure:generate
npm run allure:open
```

### 🔧 Troubleshooting & Best Practices

1. **Step Transition Drift**: If navigating between steps fails, check that all required fields on the preceding step are populated with valid baseline data from `fixtures/merchant-data.ts`.
2. **MUI Dropdowns & Popovers**: Always ensure open poppers or listboxes are dismissed via `Escape` before attempting to interact with subsequent fields.
3. **Draft Record Resumption**: Set `targetMRN` in `beforeAll` of `01-08-negative-onboarding.spec.ts` to resume any existing draft record directly from the Drafts queue.

