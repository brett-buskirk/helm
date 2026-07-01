import { test, expect } from '@playwright/test';

test('boots and shows the onboarding guide for a new user', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Helm' })).toBeVisible();
  await expect(page.getByText('Add your first client')).toBeVisible();
});

test('command palette opens with ⌘K and navigates', async ({ page }) => {
  await page.goto('/');
  // Wait for the app shell to mount so the global ⌘K key listener is attached.
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await palette.getByPlaceholder('Type a command or search…').fill('invoices');
  await palette.getByText('Invoices', { exact: true }).click();
  await expect(page).toHaveURL(/#\/invoices/);
});
