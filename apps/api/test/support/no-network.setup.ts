import { beforeEach } from 'vitest';

/**
 * The suite must never reach the internet (exchange rates come from FakeExchangeRateProvider).
 * Any `fetch` to a non-local host fails loudly. Tests that stub `fetch` themselves
 * (vi.stubGlobal) replace this guard for their own scope.
 */
const realFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
      return Promise.reject(new Error(`Network access is blocked in tests: ${url.hostname}`));
    }
    return realFetch(input, init);
  };
});
