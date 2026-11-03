import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { FrankfurterExchangeRateProvider } from './frankfurter-exchange-rate.provider.js';

// Local HTTP server only: no test reaches the internet.
const BODIES: Record<string, string> = {
    nested: '{"date":"2026-07-10","meta":{"rates":{"BRL":9.9}},"rates":{"BRL":5.5}}',
    duplicate: '{"date":"2026-07-10","rates":{"BRL":5.5,"BRL":6.6}}',
    leadingzero: '{"date":"2026-07-10","rates":{"BRL":007.5}}',
    html: '<html>captive portal</html>',
    scientific: '{"date":"2026-07-10","rates":{"BRL":1e-9}}',
};

describe('FrankfurterExchangeRateProvider (local http server)', () => {
    let server: Server;
    let base: string;
    const urls: string[] = [];

    beforeAll(async () => {
        server = createServer((req, res) => {
            urls.push(req.url ?? '');

            if (req.url?.startsWith('/slow')) return; // never answers

            const path = req.url?.split('?')[0] ?? '';
            const body = BODIES[path.split('/')[2] ?? ''];

            if (path.startsWith('/bad/') && body !== undefined) {
                res.setHeader('content-type', 'application/json');
                res.end(body);

                return;
            }

            if (path === '/redirect/latest') {
                res.statusCode = 302;
                res.setHeader('location', `/v1/latest?${req.url?.split('?')[1] ?? ''}`);
                res.end();

                return;
            }

            if (path === '/big/latest') {
                // Chunked (no content-length), endless until the client gives up.
                res.write('{"date":"2026-07-10","pad":"');
                const timer = setInterval(() => res.write('x'.repeat(8192)), 1);

                res.on('close', () => clearInterval(timer));

                return;
            }

            if (path === '/declared/latest') {
                res.setHeader('content-length', String(10 * 1024 * 1024));
                res.flushHeaders();

                return; // would send 10 MiB; the declared length alone must be refused
            }

            if (path === '/slowbody/latest') {
                res.setHeader('content-type', 'application/json');
                res.write('{"amount":1.0,"base":"USD",');

                return; // headers and a partial body arrive, the rest never does
            }

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

    it.each(Object.keys(BODIES))(
        'rejects the %s payload instead of returning a rate',
        async (name) => {
            const provider = new FrankfurterExchangeRateProvider(`${base}/bad/${name}`);

            await expect(provider.getRate('USD', 'BRL', null)).rejects.toThrow();
        },
    );

    it('does not follow redirects', async () => {
        const before = urls.length;
        const provider = new FrankfurterExchangeRateProvider(`${base}/redirect`);

        await expect(provider.getRate('USD', 'BRL', null)).rejects.toThrow();
        expect(urls.slice(before)).toEqual(['/redirect/latest?base=USD&symbols=BRL']);
    });

    it('aborts a chunked body larger than the limit', async () => {
        const provider = new FrankfurterExchangeRateProvider(`${base}/big`, 2000, 1024);
        const started = Date.now();

        await expect(provider.getRate('USD', 'BRL', null)).rejects.toThrow(/too large/);
        expect(Date.now() - started).toBeLessThan(1500);
    });

    it('refuses a declared content-length above the limit without reading the body', async () => {
        const provider = new FrankfurterExchangeRateProvider(`${base}/declared`, 2000);

        await expect(provider.getRate('USD', 'BRL', null)).rejects.toThrow(/too large/);
    });

    it('applies the timeout to the body read too', async () => {
        const provider = new FrankfurterExchangeRateProvider(`${base}/slowbody`, 200);
        const started = Date.now();

        await expect(provider.getRate('USD', 'BRL', null)).rejects.toThrow();
        expect(Date.now() - started).toBeLessThan(2000);
    });

    it('rejects unterminated or odd-quote bodies fast (child process with a hard timeout)', () => {
        // Runs outside the worker: a regression that loops synchronously gets killed after 8 s
        // and fails this test instead of freezing the whole suite.
        const bodies = [
            '{"a',
            '"',
            '{"a\\',
            '{"date":"2026-01-01","rates":{"BRL',
            '<html><p class="x>captive "portal"</p> " </html>',
        ];
        const providerUrl = new URL('./frankfurter-exchange-rate.provider.ts', import.meta.url)
            .href;
        const script = `
      import { FrankfurterExchangeRateProvider } from ${JSON.stringify(providerUrl)};
      const bodies = ${JSON.stringify(bodies)};
      let i = 0;
      globalThis.fetch = async () => new Response(bodies[i++], { status: 200 });
      const provider = new FrankfurterExchangeRateProvider('http://127.0.0.1:1');
      const out = [];
      for (let n = 0; n < bodies.length; n++) {
        out.push(await provider.getRate('USD', 'BRL', null).then(() => 'resolved', () => 'rejected'));
      }
      console.log(JSON.stringify(out));
    `;
        const result = spawnSync(
            process.execPath,
            ['--import', 'tsx', '--input-type=module', '-e', script],
            {
                encoding: 'utf8',
                timeout: 8000,
                cwd: import.meta.dirname,
            },
        );

        expect(result.error).toBeUndefined();
        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout)).toEqual(bodies.map(() => 'rejected'));
    });
});
