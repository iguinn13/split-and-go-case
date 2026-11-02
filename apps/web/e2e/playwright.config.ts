import { defineConfig, devices } from '@playwright/test';
import { webUrl } from './support/stack';

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: '../test-results',
  forbidOnly: ci,
  // Retries only on CI, and traces are kept for retried runs, so flakiness stays visible.
  retries: ci ? 1 : 0,
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: ci
    ? [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]]
    : [['list']],
  globalSetup: './support/global-setup.ts',
  globalTeardown: './support/global-teardown.ts',
  use: {
    baseURL: webUrl,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
