import { test, expect } from '@playwright/test';

test.describe('Interpolation & Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/interpolation.html');
  });

  test('text interpolation renders expression', async ({ page }) => {
    await expect(page.locator('#text-interp')).toHaveText('Hello, World!');
  });

  test('computed interpolation renders value', async ({ page }) => {
    await expect(page.locator('#computed-interp')).toHaveText('Count: 42');
  });

  test('attribute interpolation sets href', async ({ page }) => {
    await expect(page.locator('#attr-interp')).toHaveAttribute('href', '/user/abc123');
  });

  test('uppercase filter transforms text', async ({ page }) => {
    await expect(page.locator('#filter-upper')).toHaveText('WORLD');
  });

  test('lowercase filter transforms text', async ({ page }) => {
    await expect(page.locator('#filter-lower')).toHaveText('world');
  });

  test('interpolation updates reactively', async ({ page }) => {
    await page.click('#update-btn');
    await expect(page.locator('#text-interp')).toHaveText('Hello, Tapout!');
    await expect(page.locator('#filter-upper')).toHaveText('TAPOUT');
  });
});
