import { test, expect } from '@playwright/test';

/**
 * The console is one HTML file whose entire UI is built by an inline script from an
 * inline dataset. Nothing here type-checks or fails loudly at build time: a renamed
 * key or a bad divisor produces a page that still "works" while quietly showing NaN,
 * or an empty chart with no error at all. These tests are the substitute for that
 * missing safety net, so they check three things per page:
 *
 *   1. it renders at all from a cold deep link
 *   2. it renders without a console error or a failed request
 *   3. nothing that reached the screen looks like a broken binding
 */

/* Nav entries in render order — mirrors VIEWS in merchant-agent-platform-1.html,
   including the two entries spliced in further down that file (evolution, person).
   Add a page there without adding it here and the nav count assertion fails. */
const VIEWS = [
  { id: 'value', label: 'Revenue impact' },
  { id: 'attrib', label: 'Attribution & holdout' },
  { id: 'pricing', label: 'Pricing & spend cap' },
  { id: 'authz', label: 'Authorization & limits' },
  { id: 'evolution', label: 'Changes & autonomy budget' },
  { id: 'queue', label: 'Review queue' },
  { id: 'defense', label: 'Defenses & audit trail' },
  { id: 'ladder', label: 'Escalation & rollback' },
  { id: 'person', label: 'Customer audit trail' },
  { id: 'memory', label: 'Knowledge assets' },
  { id: 'tasks', label: 'Tasks & schedule' },
  { id: 'convo', label: 'Conversations' },
  { id: 'bench', label: 'Cross-store benchmark' },
  { id: 'obs', label: 'Observability & cost' },
  { id: 'setup', label: 'Scenario setup' },
  { id: 'method', label: 'Methodology & billing rules' },
];

/* Strings that only ever reach the screen when a lookup, a format, or a division
   went wrong. None of them appear in the source's prose — the two `undefined`
   occurrences in the file are both JS comparisons, never rendered text. */
const BROKEN_BINDING = /\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b/;

/** Records anything the browser complained about, from before the first navigation. */
function watchForErrors(page) {
  const problems = [];
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
  });
  page.on('requestfailed', (req) =>
    problems.push(`requestfailed: ${req.url()} — ${req.failure()?.errorText}`),
  );
  return problems;
}

test.describe('shell', () => {
  test('boots and lands on Revenue impact', async ({ page }) => {
    const problems = watchForErrors(page);
    await page.goto('/');

    await expect(page).toHaveTitle(/Afu · Revenue Partner Console/);
    await expect(page.locator('#pageTitle')).toHaveText('Revenue impact');
    await expect(page.locator('#app .section').first()).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('renders every nav entry, in order', async ({ page }) => {
    await page.goto('/');

    const items = page.locator('#nav .nav__item');
    await expect(items).toHaveCount(VIEWS.length);

    expect(await items.evaluateAll((els) => els.map((e) => e.dataset.view))).toEqual(
      VIEWS.map((v) => v.id),
    );
    expect(
      await items.evaluateAll((els) =>
        els.map((e) => e.querySelector('.nav__text').textContent.trim()),
      ),
    ).toEqual(VIEWS.map((v) => v.label));
  });

  test('the methodology strip renders under the page', async ({ page }) => {
    await page.goto('/');
    const strip = page.locator('#methodStrip');
    await expect(strip).not.toBeEmpty();
    expect(await strip.innerText()).not.toMatch(BROKEN_BINDING);
  });

  test('the spend cap reads out real numbers', async ({ page, isMobile }) => {
    // ≤768px hides .sidebar__foot, so the cap widget has no mobile equivalent.
    test.skip(isMobile, 'spend cap footer is hidden below 768px');
    await page.goto('/');

    await expect(page.locator('#capNum')).toHaveText(/NT\$[\d,]+ \/ NT\$[\d,]+/);
    await expect(page.locator('#capTopNum')).toHaveText(/\d+(\.\d+)?%/);
    await expect(page.locator('#capNote')).toContainText('left');

    // The meter is driven by a CSS custom property, so an unset one renders as a
    // full or empty bar rather than as an error.
    const value = await page
      .locator('#capMeter')
      .evaluate((el) => el.style.getPropertyValue('--value'));
    expect(value).toMatch(/^\d+(\.\d+)?%$/);
  });

  test('the revenue headline states all three figures', async ({ page }) => {
    await page.goto('/#value');
    const hero = page.locator('.hero-claim');
    await expect(hero).toBeVisible();

    // "made Furday an extra NT$X. You paid NT$Y. Net gain NT$Z."
    const amounts = (await hero.innerText()).match(/NT\$[\d,]+/g) ?? [];
    expect(amounts.length).toBeGreaterThanOrEqual(3);
  });
});

/* One test per page, each on its own page object, so every assertion below is a
   genuine cold load of that hash rather than a same-document hash change. */
test.describe('pages', () => {
  for (const view of VIEWS) {
    test(`#${view.id} renders from a cold deep link`, async ({ page }) => {
      const problems = watchForErrors(page);
      await page.goto(`/#${view.id}`);

      await expect(page.locator('#pageTitle')).toHaveText(view.label);
      await expect(page.locator(`#nav .nav__item[data-view="${view.id}"]`)).toHaveClass(
        /is-active/,
      );
      await expect(page.locator('#app .section').first()).toBeVisible();

      const text = await page.locator('#app').innerText();
      expect(text.length, `#${view.id} rendered almost nothing`).toBeGreaterThan(200);
      expect(text, `#${view.id} shows a broken value`).not.toMatch(BROKEN_BINDING);

      expect(problems).toEqual([]);
    });
  }
});

test.describe('routing', () => {
  test('clicking through the whole sidebar works', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the mobile nav strip scrolls horizontally; covered by deep links');
    const problems = watchForErrors(page);
    await page.goto('/');

    for (const view of VIEWS) {
      await page.locator(`#nav .nav__item[data-view="${view.id}"]`).click();
      await expect(page.locator('#pageTitle')).toHaveText(view.label);
      await expect(page.locator('#app .section').first()).toBeVisible();
    }

    expect(problems).toEqual([]);
  });

  test('a customer drilldown hash opens that customer', async ({ page }) => {
    const problems = watchForErrors(page);
    await page.goto('/#person/C-6284');

    await expect(page.locator('#pageTitle')).toHaveText('Customer audit trail');
    await expect(page.locator('#app')).toContainText('C-6284');
    expect(problems).toEqual([]);
  });

  test('an unknown hash falls back to the first page instead of blanking', async ({ page }) => {
    const problems = watchForErrors(page);
    await page.goto('/#no-such-page');

    await expect(page.locator('#pageTitle')).toHaveText('Revenue impact');
    await expect(page.locator('#app .section').first()).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('going back restores the previous page', async ({ page }) => {
    await page.goto('/#value');
    await page.goto('/#method');
    await expect(page.locator('#pageTitle')).toHaveText('Methodology & billing rules');

    await page.goBack();
    await expect(page.locator('#pageTitle')).toHaveText('Revenue impact');
  });
});

test.describe('layout', () => {
  test('the page never scrolls sideways', async ({ page }) => {
    await page.goto('/');

    for (const view of VIEWS) {
      await page.goto(`/#${view.id}`);
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      // 1px of slack for sub-pixel rounding at fractional device pixel ratios.
      expect(
        overflow.scroll,
        `#${view.id} overflows horizontally (${overflow.scroll} > ${overflow.client})`,
      ).toBeLessThanOrEqual(overflow.client + 1);
    }
  });
});
