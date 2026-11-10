import { test, expect } from '@playwright/test';

test.describe('SVG custom elements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/svg-components.html');
  });

  test('custom element inside svg is replaced by a marked <g> host', async ({ page }) => {
    const host = page.locator('g[data-tap-component="svg-badge"]');
    await expect(host).toHaveCount(1);
    await expect(host).toHaveAttribute('class', 'b');
    await expect(host).toHaveAttribute('transform', 'translate(10 10)');
    await expect(page.locator('svg-badge')).toHaveCount(0);
  });

  test('rendered child has a non-zero bounding box', async ({ page }) => {
    const box = await page.evaluate(() => {
      const b = (document.getElementById('badge-circle') as unknown as SVGGraphicsElement).getBBox();
      return { width: b.width, height: b.height };
    });
    expect(box.width).toBe(80);
    expect(box.height).toBe(80);
  });

  test('component param updates the rendered shape', async ({ page }) => {
    await page.evaluate(() => (window as unknown as { vm: { radius: { set(v: number): void } } }).vm.radius.set(10));
    const box = await page.evaluate(() => {
      const b = (document.getElementById('badge-circle') as unknown as SVGGraphicsElement).getBBox();
      return b.width;
    });
    expect(box).toBe(20);
  });
});
