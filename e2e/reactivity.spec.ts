import { test, expect } from '@playwright/test';

test.describe('Reactivity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reactivity.html');
  });

  test('text binding renders observable value', async ({ page }) => {
    await expect(page.locator('#name-display')).toHaveText('World');
  });

  test('computed binding renders derived value', async ({ page }) => {
    await expect(page.locator('#greeting')).toHaveText('Hello, World!');
  });

  test('click binding increments counter', async ({ page }) => {
    await expect(page.locator('#counter-display')).toHaveText('0');
    await page.click('#increment-btn');
    await expect(page.locator('#counter-display')).toHaveText('1');
    await page.click('#increment-btn');
    await expect(page.locator('#counter-display')).toHaveText('2');
  });

  test('click updates observable and computed re-evaluates', async ({ page }) => {
    await expect(page.locator('#greeting')).toHaveText('Hello, World!');
    await page.click('#set-name-btn');
    await expect(page.locator('#name-display')).toHaveText('Tapout');
    await expect(page.locator('#greeting')).toHaveText('Hello, Tapout!');
  });

  test('visible binding shows element when true', async ({ page }) => {
    await expect(page.locator('#visible-section')).toBeVisible();
    await expect(page.locator('#hidden-section')).not.toBeVisible();
  });
});
