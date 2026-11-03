import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { normalizeRate, parseProviderPayload } from './rate-parser.js';

const payload = (rates: string, extra = '') =>
    `{"amount":1.0,"base":"USD","date":"2026-07-10",${extra}"rates":${rates}}`;

describe('parseProviderPayload', () => {
    it('keeps the raw token without float conversion and returns the top-level date', () => {
        const json = payload('{"BRL":5.43251234567891}');

        expect(parseProviderPayload(json, 'BRL')).toEqual({
            token: '5.43251234567891',
            date: '2026-07-10',
        });
    });

    it('keeps trailing zeros in the token (normalizeRate strips them later)', () => {
        expect(parseProviderPayload(payload('{"BRL":5.4300}'), 'BRL')?.token).toBe('5.4300');
    });

    it('tolerates whitespace, key order and unrelated top-level keys', () => {
        const json =
            '{ "rates" : { "BRL" : 5.5 } , "extra": [1, {"x": "y"}], "date": "2026-07-10" }';

        expect(parseProviderPayload(json, 'BRL')).toEqual({ token: '5.5', date: '2026-07-10' });
    });

    it('rejects a nested rates object instead of returning its value', () => {
        const json = payload('{"BRL":5.5}', '"meta":{"rates":{"BRL":9.9}},');

        expect(parseProviderPayload(json, 'BRL')).toBeNull();
        const only = '{"date":"2026-07-10","meta":{"rates":{"BRL":9.9}}}';

        expect(parseProviderPayload(only, 'BRL')).toBeNull();
    });

    it('rejects duplicate keys, anywhere', () => {
        expect(parseProviderPayload(payload('{"BRL":5.5,"BRL":6.6}'), 'BRL')).toBeNull();
        expect(parseProviderPayload(payload('{"BRL":5.5,"\\u0042RL":6.6}'), 'BRL')).toBeNull();
        expect(
            parseProviderPayload(
                payload('{"BRL":5.5}').replace('"base"', '"date":"2026-01-01","base"'),
                'BRL',
            ),
        ).toBeNull();
        const twoRates = '{"date":"2026-07-10","rates":{"BRL":1.5},"rates":{"BRL":2.5}}';

        expect(parseProviderPayload(twoRates, 'BRL')).toBeNull();
    });

    it('does not mistake string values containing braces or quotes for keys', () => {
        const json = '{"note":"a\\"b,{\\"BRL\\":1}","date":"2026-07-10","rates":{"BRL":5.5}}';

        expect(parseProviderPayload(json, 'BRL')?.token).toBe('5.5');
    });

    it('rejects invalid JSON, including leading zeros and trailing garbage', () => {
        expect(parseProviderPayload(payload('{"BRL":007.5}'), 'BRL')).toBeNull();
        expect(parseProviderPayload(payload('{"BRL":5.5}') + 'x', 'BRL')).toBeNull();
        expect(parseProviderPayload('', 'BRL')).toBeNull();
        expect(parseProviderPayload('<html>oops</html>', 'BRL')).toBeNull();
        expect(parseProviderPayload('{"rates":{"BRL":5.5}', 'BRL')).toBeNull();
    });

    it('rejects unexpected shapes', () => {
        expect(parseProviderPayload('[]', 'BRL')).toBeNull();
        expect(parseProviderPayload('null', 'BRL')).toBeNull();
        expect(parseProviderPayload('{}', 'BRL')).toBeNull();
        expect(parseProviderPayload(payload('[5.5]'), 'BRL')).toBeNull();
        expect(parseProviderPayload(payload('{"BRL":{"v":5.5}}'), 'BRL')).toBeNull();
        expect(parseProviderPayload(payload('{"EUR":1.1}'), 'BRL')).toBeNull();
        expect(parseProviderPayload(payload('{"BRL":5.5,"EUR":1.1}'), 'BRL')).toBeNull();
        expect(parseProviderPayload('{"rates":{"BRL":5.5}}', 'BRL')).toBeNull(); // no date
        expect(parseProviderPayload('{"date":"10/07/2026","rates":{"BRL":5.5}}', 'BRL')).toBeNull();
        expect(parseProviderPayload('{"date":20260710,"rates":{"BRL":5.5}}', 'BRL')).toBeNull();
    });

    it('rejects scientific notation, strings, negatives and non-numbers', () => {
        for (const value of ['1e-9', '1E5', '"5.4"', '-5.4', 'null', 'true']) {
            expect(parseProviderPayload(payload(`{"BRL":${value}}`), 'BRL')).toBeNull();
        }
    });
});

// A regression of the old unbounded scan hangs synchronously; run in a child process so the
// hard timeout can actually kill it instead of freezing the suite.
describe('parseProviderPayload with unterminated or odd-quote input', () => {
    const inputs = [
        '{"a',
        '"',
        '{"a\\',
        '{"date":"2026-01-01","rates":{"BRL',
        '<html><p class="x>captive "portal"</p> " </html>',
        '{"date":"2026-07-10","rates":{"BRL":5.5',
        '{"date":"2026-07-10","rates":{"BRL":5.5}}"',
    ];

    it('returns null for every input and finishes quickly', () => {
        const script = `
      import { parseProviderPayload } from ${JSON.stringify(new URL('./rate-parser.ts', import.meta.url).href)};
      const inputs = ${JSON.stringify(inputs)};
      console.log(JSON.stringify(inputs.map((i) => parseProviderPayload(i, 'BRL'))));
    `;
        const result = spawnSync(
            process.execPath,
            ['--import', 'tsx', '--input-type=module', '-e', script],
            {
                encoding: 'utf8',
                timeout: 5000,
                cwd: import.meta.dirname,
            },
        );

        expect(result.error).toBeUndefined();
        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout)).toEqual(inputs.map(() => null));
    });
});

describe('normalizeRate', () => {
    it('strips trailing zeros and keeps up to 8 decimals', () => {
        expect(normalizeRate('5.4325')).toBe('5.4325');
        expect(normalizeRate('5.43250000')).toBe('5.4325');
        expect(normalizeRate('157')).toBe('157');
        expect(normalizeRate('1.0')).toBe('1');
        expect(normalizeRate('0.0345')).toBe('0.0345');
    });
    it('rounds half up beyond 8 decimals (not truncate)', () => {
        expect(normalizeRate('1.123456784')).toBe('1.12345678');
        expect(normalizeRate('1.123456785')).toBe('1.12345679');
        expect(normalizeRate('0.999999999')).toBe('1');
        expect(normalizeRate('0.000000005')).toBe('0.00000001');
    });
    it('keeps precision a double would lose', () => {
        expect(normalizeRate('12345.12345678')).toBe('12345.12345678');
    });
    it('rejects zero, overflow and non-decimal input', () => {
        expect(normalizeRate('0')).toBeNull();
        expect(normalizeRate('0.000000004')).toBeNull();
        expect(normalizeRate('12345678901')).toBeNull();
        expect(normalizeRate('1e5')).toBeNull();
        expect(normalizeRate('-1')).toBeNull();
    });
});
