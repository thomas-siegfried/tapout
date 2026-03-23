import { test, expect } from '@playwright/test';

test.describe('Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/components.html');
  });

  test('custom element renders component template', async ({ page }) => {
    const greeting = page.locator('greeting-widget .greeting span');
    await expect(greeting).toHaveText('Welcome, Tapout User!');
  });

  test('component binding renders via data-bind', async ({ page }) => {
    const panelTitle = page.locator('#inline-component .panel h3');
    await expect(panelTitle).toHaveText('Dashboard');
    const panelBody = page.locator('#inline-component .panel p');
    await expect(panelBody).toHaveText('Panel body');
  });
});
