"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllureReporterHelper = void 0;
const allure_playwright_1 = require("allure-playwright");
/**
 * Allure Reporting Metadata & Helper Utilities.
 * WHY: Enriches Playwright test runs with Epics, Features, Stories, Severity levels,
 * custom steps, and environment metadata for historical trend dashboards.
 */
class AllureReporterHelper {
    /** Tag a test with an Epic (e.g. "Merchant Onboarding") */
    static setEpic(name) {
        try {
            allure_playwright_1.allure.epic(name);
        }
        catch (_) { }
    }
    /** Tag a test with a Feature (e.g. "Step 1 Profile Validation") */
    static setFeature(name) {
        try {
            allure_playwright_1.allure.feature(name);
        }
        catch (_) { }
    }
    /** Tag a test with a Story / Jira Ticket (e.g. "QI-1024 Negative Matrix") */
    static setStory(name) {
        try {
            allure_playwright_1.allure.story(name);
        }
        catch (_) { }
    }
    /** Set test severity level ('blocker' | 'critical' | 'normal' | 'minor' | 'trivial') */
    static setSeverity(level) {
        try {
            allure_playwright_1.allure.severity(level);
        }
        catch (_) { }
    }
    /** Add custom key-value metadata parameter */
    static addParameter(name, value) {
        try {
            allure_playwright_1.allure.parameter(name, value);
        }
        catch (_) { }
    }
    /** Wrap a sub-step block inside Allure timeline report */
    static async step(name, body) {
        try {
            await allure_playwright_1.allure.step(name, body);
        }
        catch (_) {
            await body();
        }
    }
    /** Attach raw text or JSON data to Allure report */
    static attachJson(name, data) {
        try {
            allure_playwright_1.allure.attachment(name, JSON.stringify(data, null, 2), 'application/json');
        }
        catch (_) { }
    }
}
exports.AllureReporterHelper = AllureReporterHelper;
