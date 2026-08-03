import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // 430px and below collapses the sidebar into a horizontal strip and hides the
    // spend-cap footer, so mobile gets its own pass rather than being assumed.
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],

  // Builds first so `npx playwright test` works from a clean checkout with no
  // separate build step to remember. python3 ships on every GitHub runner and on
  // macOS, which avoids adding a static-server dependency for one command.
  webServer: {
    command: `node scripts/build.mjs && python3 -m http.server ${PORT} --bind 127.0.0.1 --directory dist`,
    url: `${BASE_URL}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
  },
});
