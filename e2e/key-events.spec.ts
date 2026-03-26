import { test, expect } from '@playwright/test';

test.describe('Key Event Bindings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/key-events.html');
  });

  test('keydown.enter fires on Enter key', async ({ page }) => {
    await expect(page.locator('#enter-count')).toHaveText('0');
    await page.locator('#enter-input').press('Enter');
    await expect(page.locator('#enter-count')).toHaveText('1');
    await page.locator('#enter-input').press('Enter');
    await expect(page.locator('#enter-count')).toHaveText('2');
  });

  test('keydown.enter does not fire on other keys', async ({ page }) => {
    await page.locator('#enter-input').press('Escape');
    await page.locator('#enter-input').press('Tab');
    await expect(page.locator('#enter-count')).toHaveText('0');
  });

  test('keydown.esc fires on Escape key', async ({ page }) => {
    await expect(page.locator('#esc-count')).toHaveText('0');
    await page.locator('#esc-input').press('Escape');
    await expect(page.locator('#esc-count')).toHaveText('1');
  });

  test('keydown.esc does not fire on Enter', async ({ page }) => {
    await page.locator('#esc-input').press('Enter');
    await expect(page.locator('#esc-count')).toHaveText('0');
  });

  test('keydown.enter.ctrl fires only with Ctrl+Enter', async ({ page }) => {
    await page.locator('#ctrl-enter-input').press('Enter');
    await expect(page.locator('#ctrl-enter-count')).toHaveText('0');

    await page.locator('#ctrl-enter-input').press('Control+Enter');
    await expect(page.locator('#ctrl-enter-count')).toHaveText('1');
  });

  test('legacy enter binding still works', async ({ page }) => {
    await expect(page.locator('#legacy-enter-count')).toHaveText('0');
    await page.locator('#legacy-enter-input').press('Enter');
    await expect(page.locator('#legacy-enter-count')).toHaveText('1');
  });

  test('keyup.space fires on Space keyup', async ({ page }) => {
    await expect(page.locator('#keyup-space-count')).toHaveText('0');
    await page.locator('#keyup-space-input').press('Space');
    await expect(page.locator('#keyup-space-count')).toHaveText('1');
  });

  test('plain keydown fires for any key and receives event', async ({ page }) => {
    await page.locator('#last-key-input').press('a');
    await expect(page.locator('#last-key')).toHaveText('a');

    await page.locator('#last-key-input').press('Escape');
    await expect(page.locator('#last-key')).toHaveText('Escape');
  });
});
