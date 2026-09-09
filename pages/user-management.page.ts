import { Page, expect } from '@playwright/test';

/**
 * Page Object for Administrator User Management.
 * Encapsulates searching users, viewing lockout status, and unlocking/reactivating accounts.
 */
export class UserManagementPage {
  constructor(private page: Page) {}

  /** Navigate to the User management section. */
  async navigateToUserManagement() {
    const link = this.page.locator('button:has-text("User management"), a:has-text("User management"), nav :text("User management"), text="User management"').first();
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.click();
    await this.page.waitForURL('**/admin/users', { timeout: 10000 }).catch(() => {});
  }

  /** Search/filter by username in the user list. */
  async filterUser(username: string) {
    const input = this.page.locator('input[placeholder*="Search by username" i], input[placeholder*="Search" i]').first();
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.click();
    await input.fill(username);
    await this.page.waitForTimeout(500);
  }

  /** Check if a specific user is in locked status. */
  async isUserLocked(username: string): Promise<boolean> {
    await this.filterUser(username);
    const row = this.page.locator(`tbody tr:has-text("${username}")`).first();
    const text = await row.innerText().catch(() => '');
    return /locked|disabled/i.test(text);
  }

  /** Open the user edit drawer for a specific username. */
  async openUserDrawer(username: string) {
    await this.filterUser(username);
    const editBtn = this.page.locator(`button[aria-label*="Edit ${username}" i], tbody tr:has-text("${username}") button`).first();
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();
    await expect(this.page.locator('text="Email address *"').first()).toBeVisible({ timeout: 5000 });
  }

  /** Unlock and reactivate a user account from the slide-out drawer. */
  async unlockUser(username: string) {
    await this.openUserDrawer(username);

    // Open Status dropdown if needed
    const statusBox = this.page.locator('div[role="combobox"]').nth(1); // Second combobox is Status (First is Role)
    if (await statusBox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusBox.click();
      const activeOption = this.page.locator('[role="listbox"] [role="option"]:has-text("Active"), .MuiMenuItem-root:has-text("Active")').first();
      if (await activeOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await activeOption.click();
      }
    }

    // Click Save changes
    const saveBtn = this.page.locator('button:has-text("Save changes"), button:has-text("Save")').first();
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();

    await this.page.waitForTimeout(1000);
  }
}
