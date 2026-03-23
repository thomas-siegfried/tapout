import { test, expect } from '@playwright/test';

test.describe('Control Flow Bindings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/control-flow.html');
  });

  test('if binding toggles section visibility', async ({ page }) => {
    await expect(page.locator('#if-content')).toBeVisible();
    await page.click('#toggle-btn');
    await expect(page.locator('#if-content')).not.toBeVisible();
    await page.click('#toggle-btn');
    await expect(page.locator('#if-content')).toBeVisible();
  });

  test('foreach binding renders list items', async ({ page }) => {
    const items = page.locator('.list-item');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toHaveText('Apple');
    await expect(items.nth(1)).toHaveText('Banana');
    await expect(items.nth(2)).toHaveText('Cherry');
  });

  test('foreach dynamically adds items', async ({ page }) => {
    await expect(page.locator('#item-count')).toHaveText('3');
    await page.click('#add-btn');
    await expect(page.locator('.list-item')).toHaveCount(4);
    await expect(page.locator('#item-count')).toHaveText('4');
    await expect(page.locator('.list-item').nth(3)).toHaveText('Item 1');
  });

  test('foreach dynamically removes items', async ({ page }) => {
    await page.click('#remove-btn');
    await expect(page.locator('.list-item')).toHaveCount(2);
    await expect(page.locator('#item-count')).toHaveText('2');
  });

  test('with binding renders child context', async ({ page }) => {
    await expect(page.locator('#person-name')).toHaveText('Alice');
    await expect(page.locator('#person-age')).toHaveText('30');
  });
});
