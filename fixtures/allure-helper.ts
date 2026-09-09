import { allure } from 'allure-playwright';

/**
 * Allure Reporting Metadata & Helper Utilities.
 * WHY: Enriches Playwright test runs with Epics, Features, Stories, Severity levels,
 * custom steps, and environment metadata for historical trend dashboards.
 */
export class AllureReporterHelper {
  /** Tag a test with an Epic (e.g. "Merchant Onboarding") */
  static setEpic(name: string): void {
    try { allure.epic(name); } catch (_) {}
  }

  /** Tag a test with a Feature (e.g. "Step 1 Profile Validation") */
  static setFeature(name: string): void {
    try { allure.feature(name); } catch (_) {}
  }

  /** Tag a test with a Story / Jira Ticket (e.g. "QI-1024 Negative Matrix") */
  static setStory(name: string): void {
    try { allure.story(name); } catch (_) {}
  }

  /** Set test severity level ('blocker' | 'critical' | 'normal' | 'minor' | 'trivial') */
  static setSeverity(level: 'blocker' | 'critical' | 'normal' | 'minor' | 'trivial'): void {
    try { allure.severity(level); } catch (_) {}
  }

  /** Add custom key-value metadata parameter */
  static addParameter(name: string, value: string): void {
    try { allure.parameter(name, value); } catch (_) {}
  }

  /** Wrap a sub-step block inside Allure timeline report */
  static async step(name: string, body: () => Promise<void>): Promise<void> {
    try {
      await allure.step(name, body);
    } catch (_) {
      await body();
    }
  }

  /** Attach raw text or JSON data to Allure report */
  static attachJson(name: string, data: object): void {
    try {
      allure.attachment(name, JSON.stringify(data, null, 2), 'application/json');
    } catch (_) {}
  }
}
