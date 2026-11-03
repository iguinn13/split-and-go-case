import { describe, expect, it } from 'vitest';

describe('Test environment (e2e)', () => {
    it('blocks outgoing requests to the internet', async () => {
        await expect(fetch('https://api.frankfurter.dev/v1/latest')).rejects.toThrow(
            /Network access is blocked/,
        );
    });
});
