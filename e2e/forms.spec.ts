import { test, expect } from '@playwright/test';

test.describe('Form Bindings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forms.html');
  });

  test('textInput binding updates display as you type', async ({ page }) => {
    await expect(page.locator('#text-mirror')).toHaveText('');
    await page.fill('#text-input', 'Hello Tapout');
    await expect(page.locator('#text-mirror')).toHaveText('Hello Tapout');
  });

  test('value binding updates on change', async ({ page }) => {
    await expect(page.locator('#value-mirror')).toHaveText('');
    await page.fill('#value-input', 'alice');
    await page.locator('#value-input').dispatchEvent('change');
    await expect(page.locator('#value-mirror')).toHaveText('alice');
  });

  test('checked binding toggles state', async ({ page }) => {
    await expect(page.locator('#check-status')).toHaveText('OFF');
    await page.check('#checkbox');
    await expect(page.locator('#check-status')).toHaveText('ON');
    await page.uncheck('#checkbox');
    await expect(page.locator('#check-status')).toHaveText('OFF');
  });

  test('select value binding updates on selection', async ({ page }) => {
    await expect(page.locator('#color-display')).toHaveText('red');
    await page.selectOption('#selector', 'blue');
    await expect(page.locator('#color-display')).toHaveText('blue');
  });
});
