import { test, expect } from '@playwright/test';

test('creates a client through the form and shows it in the list', async ({ page }) => {
  await page.goto('/#/clients');

  await page.getByRole('button', { name: 'New Client' }).first().click();
  const drawer = page.getByRole('dialog', { name: 'New Client' });
  await expect(drawer).toBeVisible();

  await drawer.getByLabel(/company/i).fill('Playwright Co');
  await drawer.getByLabel(/contact name/i).fill('Ada Test');
  await drawer.getByLabel(/email/i).fill('ada@playwright.co');
  await page.getByRole('button', { name: 'Create Client' }).click();

  await expect(page.getByText('Playwright Co')).toBeVisible();
});

test('loads sample data and populates the clients list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /load sample data/i }).click();

  await page.getByRole('link', { name: 'Clients' }).click();
  await expect(page).toHaveURL(/#\/clients/);
  await expect(page.locator('tbody tr').first()).toBeVisible();
});
