# Allure Reporting & Diagnostics Guide

Comprehensive guide for generating, viewing, and diagnosing test results using **Allure Reporting** and **Playwright Diagnostics**.

---

## 1. How Allure Reporting Works

- **Raw Test Results**: When tests execute, Playwright's `allure-playwright` reporter generates JSON result files in `allure-results/`.
- **Automatic Cache Cleaning**: The [`global-setup.ts`](file:///C:/Users/Kiran/.gemini/antigravity/scratch/qiplus-e2e/global-setup.ts) hook wipes old results strictly **once before any test run starts**, guaranteeing that every report displays 100% fresh data.
- **Automatic Post-Run Report Compilation**: The [`global-teardown.ts`](file:///C:/Users/Kiran/.gemini/antigravity/scratch/qiplus-e2e/global-teardown.ts) hook automatically runs `allure generate` immediately after **every test run** (in VS Code Test Explorer, Run & Debug, or Terminal), keeping `allure-report/` constantly updated without requiring manual commands!

---

## 2. Allure Commands

### 1. View Live Allure Report (Recommended)
After executing your tests, run:
```powershell
npm run allure:serve
```
*This command automatically compiles the results from `allure-results/` and opens the interactive Allure Dashboard live in your default web browser.*

---

### 2. Generate Static Report Folder (For CI/CD or Sharing)
To generate a standalone folder containing static HTML assets (`allure-report/`):
```powershell
npm run allure:generate
```

---

### 3. Open Existing Static Report
To open a previously generated static report folder:
```powershell
npm run allure:open
```

---

## 3. What You See in Allure Dashboard

- **Overview Page**: Overall pass/fail rate, execution time, and test category breakdowns.
- **Suites Tab**: Hierarchical breakdown of every spec file with execution time for each individual step (Step 1 through Step 8).
- **Behaviors / Features**: Grouping by feature area (Onboarding, Compliance Review, Final Approval, Status Transitions).
- **Attachments**:
  - Full-resolution PNG screenshots on failure.
  - Video recordings of failed test runs.
  - Detailed diagnostic JSON attachments.

---

## 4. Diagnostics & Failure Triage System

When a test step fails, the custom diagnostic fixture ([`fixtures/diagnostics.ts`](file:///C:/Users/Kiran/.gemini/antigravity/scratch/qiplus-e2e/fixtures/diagnostics.ts)) automatically classifies the failure and attaches logs:

| Attached File in Allure / HTML | What It Means | Action to Take |
|:---|:---|:---|
| **`failed-network-responses.json`** | **Likely BACKEND** — An API returned 4xx or 500 status. | Check HTTP endpoint and payload in the JSON file. |
| **`console-errors.json`** / **`page-errors.json`** | **Likely FRONTEND** — Browser JavaScript thrown exception. | Check error stack in JSON file. |
| *All 3 files are empty* | **Script / Locator Issue** — DOM selector timing issue. | Inspect the Playwright Trace snapshot. |

---

## 5. Playwright HTML Report & Trace Viewer

In addition to Allure, you can open the built-in Playwright HTML report and interactive Trace viewer:

```powershell
npx playwright show-report
```

To inspect a specific trace file recorded on failure:
```powershell
npx playwright show-trace test-results/<test-folder>/trace.zip
```
