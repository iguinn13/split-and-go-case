import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { FrankfurterExchangeRateProvider } from './frankfurter-exchange-rate.provider.js';

// Local HTTP server only: no test reaches the internet.
describe('FrankfurterExchangeRateProvider (local http server)', () => {
  let server: Server;
  let base: string;
  const urls: string[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      urls.push(req.url ?? '');
      if (req.url?.startsWith('/slow')) return; // never answers
      if (req.url?.startsWith('/v1/2026-01-01')) {
        res.statusCode = 404;
        res.end('{"message":"not found"}');
        return;
      }
      res.setHeader('content-type', 'application/json');
      res.end('{"amount":1.0,"base":"USD","date":"2026-07-09","rates":{"BRL":5.432512345}}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  it('builds the request, parses the rate as text and rounds half up', async () => {
    const provider = new FrankfurterExchangeRateProvider(`${base}/v1/`);
    const result = await provider.getRate('USD', 'BRL', '2026-07-10');
    expect(result).toEqual({ rate: '5.43251235', date: '2026-07-09' });
    expect(urls.at(-1)).toBe('/v1/2026-07-10?base=USD&symbols=BRL');
    await provider.getRate('USD', 'BRL', null);
    expect(urls.at(-1)).toBe('/v1/latest?base=USD&symbols=BRL');
  });

  it('throws on non-2xx responses', async () => {
    const provider = new FrankfurterExchangeRateProvider(`${base}/v1`);
    await expect(provider.getRate('USD', 'BRL', '2026-01-01')).rejects.toThrow();
  });

  it('throws on timeout', async () => {
    const provider = new FrankfurterExchangeRateProvider(`${base}/slow`, 150);
    const started = Date.now();
    await expect(provider.getRate('USD', 'BRL', null)).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('throws when the provider is unreachable', async () => {
    const provider = new FrankfurterExchangeRateProvider('http://127.0.0.1:1', 500);
    await expect(provider.getRate('USD', 'BRL', null)).rejects.toThrow();
  });
});
