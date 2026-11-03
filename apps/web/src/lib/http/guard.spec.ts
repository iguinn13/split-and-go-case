import { describe, expect, it } from 'vitest';
import { guardMutation, guardUuids, isUuid } from './guard';

const req = (headers: Record<string, string>) =>
    new Request('http://localhost:3000/api/x', { method: 'POST', headers });

describe('guardUuids', () => {
    it('accepts UUIDs and rejects path tricks', () => {
        const id = '0b0f3a4e-7c1d-4f43-8f6a-3c1d2e4f5a6b';

        expect(isUuid(id)).toBe(true);
        expect(guardUuids(id, id)).toBeNull();
        expect(guardUuids(id, '../members')?.status).toBe(422);
        expect(guardUuids('abc')?.status).toBe(422);
        expect(guardUuids(`${id}/x`)?.status).toBe(422);
    });
});

describe('guardMutation', () => {
    const json = { 'content-type': 'application/json', host: 'localhost:3000' };

    it('allows same-origin JSON and header-less origins', () => {
        expect(guardMutation(req({ ...json, origin: 'http://localhost:3000' }))).toBeNull();
        expect(guardMutation(req(json))).toBeNull();
    });

    it('rejects a foreign origin with 403', () => {
        expect(guardMutation(req({ ...json, origin: 'https://evil.example' }))?.status).toBe(403);
    });

    it('accepts Origin null only when Sec-Fetch-Site is same-origin', () => {
        const nullOrigin = { ...json, origin: 'null' };

        expect(guardMutation(req({ ...nullOrigin, 'sec-fetch-site': 'same-origin' }))).toBeNull();

        for (const site of ['cross-site', 'same-site', 'none']) {
            expect(guardMutation(req({ ...nullOrigin, 'sec-fetch-site': site }))?.status).toBe(403);
        }

        expect(guardMutation(req(nullOrigin))?.status).toBe(403);
    });

    it('still rejects a foreign Origin even when Sec-Fetch-Site says same-origin', () => {
        const forged = { ...json, origin: 'https://evil.example', 'sec-fetch-site': 'same-origin' };

        expect(guardMutation(req(forged))?.status).toBe(403);
    });

    it('rejects non-JSON bodies with 415 unless json is not required', () => {
        const form = { host: 'localhost:3000', 'content-type': 'text/plain' };

        expect(guardMutation(req(form))?.status).toBe(415);
        expect(guardMutation(req(form), { json: false })).toBeNull();
    });
});
