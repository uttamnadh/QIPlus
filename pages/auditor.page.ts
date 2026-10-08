import { Page, Locator, expect } from '@playwright/test';

export interface AuditLogEntry {
  performedBy: string;
  action: string;
  resource: string;
  status: string;
  eventTime: string;
}

export class AuditorPage {
  readonly page: Page;

  // Sidebar navigation
  readonly sidebarDashboardLink: Locator;
  readonly sidebarMerchantSearchLink: Locator;
  readonly sidebarAuditLogsLink: Locator;

  // Merchant Search Locators
  readonly merchantSearchFilterInput: Locator;
  readonly merchantTableRows: Locator;
  readonly exportToExcelButton: Locator;

  // Audit Logs Locators
  readonly auditMerchantInput: Locator;
  readonly auditSearchButton: Locator;
  readonly auditResetButton: Locator;
  readonly auditTableRows: Locator;

  constructor(page: Page) {
    this.page = page;

    // Sidebar
    this.sidebarDashboardLink = page.locator('a[href*="/dashboard"], nav >> text="Dashboard"').first();
    this.sidebarMerchantSearchLink = page.locator('a[href*="/merchants/search"], nav >> text="Merchant search"').first();
    this.sidebarAuditLogsLink = page.locator('a[href*="/audit/logs"], nav >> text="Audit logs"').first();

    // Merchant Search
    this.merchantSearchFilterInput = page.locator('input[placeholder="Filter by MRN or company name"], input[placeholder*="MRN" i]').first();
    this.merchantTableRows = page.locator('tbody tr, [role="row"]');
    this.exportToExcelButton = page.locator('button:has-text("Export to Excel")').first();

    // Audit Logs
    this.auditMerchantInput = page.locator('input[placeholder="Any merchant"], input[name*="mrn" i]').first();
    this.auditSearchButton = page.locator('button:has-text("Search")').first();
    this.auditResetButton = page.locator('button:has-text("Reset")').first();
    this.auditTableRows = page.locator('tbody tr, [role="row"]');
  }

  async navigateToMerchantSearch(): Promise<void> {
    if (await this.sidebarMerchantSearchLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.sidebarMerchantSearchLink.click();
    } else {
      await this.page.goto('https://idms-uat.qiplus.ae/merchants/search', { waitUntil: 'domcontentloaded' });
    }
    await this.page.waitForURL('**/merchants/search', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async searchMerchant(mrn: string): Promise<{ found: boolean; rowText: string }> {
    await this.merchantSearchFilterInput.waitFor({ state: 'visible', timeout: 8000 });
    await this.merchantSearchFilterInput.fill(mrn);
    await this.page.waitForTimeout(1000);

    const targetRow = this.page.locator(`tbody tr:has-text("${mrn}"), [role="row"]:has-text("${mrn}")`).first();
    const isVisible = await targetRow.isVisible({ timeout: 5000 }).catch(() => false);
    const rowText = isVisible ? (await targetRow.innerText()).replace(/\s+/g, ' ').trim() : '';

    return { found: isVisible, rowText };
  }

  async openMerchantDetail(mrn: string): Promise<void> {
    const targetRow = this.page.locator(`tbody tr:has-text("${mrn}"), [role="row"]:has-text("${mrn}")`).first();
    await targetRow.waitFor({ state: 'visible', timeout: 8000 });
    await targetRow.click();
    await this.page.waitForURL(`**/merchants/${mrn}`, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async verifyMerchantDetailSections(expected?: { tradeName?: string; legalName?: string }): Promise<boolean> {
    // Check main profile headings
    const profileHeading = this.page.locator('h1, h2, h3, h4').filter({ hasText: /Merchant profile/i }).first();
    await expect(profileHeading).toBeVisible({ timeout: 8000 });

    if (expected?.legalName) {
      const legalNameEl = this.page.locator(`text="${expected.legalName}"`).first();
      await expect(legalNameEl).toBeVisible({ timeout: 5000 });
    }

    // Verify key audit view sections exist
    const sections = [
      'Registration',
      'Licence',
      'Contact & banking',
      'Business profile',
      'Ownership & control',
      'Submitted documents',
      'Activity history'
    ];

    for (const sec of sections) {
      const secEl = this.page.locator(`text="${sec}"`).first();
      await expect(secEl, `Expected section "${sec}" in Merchant audit detail view`).toBeVisible({ timeout: 5000 });
    }

    return true;
  }

  async navigateToAuditLogs(): Promise<void> {
    if (await this.sidebarAuditLogsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.sidebarAuditLogsLink.click();
    } else {
      await this.page.goto('https://idms-uat.qiplus.ae/audit/logs', { waitUntil: 'domcontentloaded' });
    }
    await this.page.waitForURL('**/audit/logs', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async searchAuditLogsByMRN(mrn: string): Promise<string[]> {
    await this.auditMerchantInput.waitFor({ state: 'visible', timeout: 8000 });
    await this.auditMerchantInput.fill(mrn);
    await this.auditSearchButton.click();
    await this.page.waitForTimeout(1500);
    await this.page.waitForLoadState('networkidle').catch(() => {});

    const rows = await this.page.locator('tbody tr').allInnerTexts();
    return rows.map(r => r.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  async getAuditEntriesCount(mrn: string): Promise<number> {
    const rows = await this.searchAuditLogsByMRN(mrn);
    return rows.length;
  }
}
