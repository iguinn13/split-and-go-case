import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.schema.js';

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://x', JWT_SECRET: 'test-secret' });
    expect(env.PORT).toBe(3001);
    expect(env.FX_PROVIDER_URL).toBe('https://api.frankfurter.dev/v1');
  });

  it('coerces PORT and accepts FX_PROVIDER_URL', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://x',
      JWT_SECRET: 'test-secret',
      PORT: '4000',
      FX_PROVIDER_URL: 'http://localhost:9999',
    });
    expect(env.PORT).toBe(4000);
    expect(env.FX_PROVIDER_URL).toBe('http://localhost:9999');
  });

  it('requires DATABASE_URL', () => {
    expect(() => loadEnv({ JWT_SECRET: 'test-secret' })).toThrow(/DATABASE_URL/);
  });

  it('requires JWT_SECRET', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgresql://x' })).toThrow(/JWT_SECRET/);
  });

  it('throws on invalid configuration', () => {
    expect(() =>
      loadEnv({ DATABASE_URL: 'postgresql://x', JWT_SECRET: 'test-secret', PORT: 'abc' }),
    ).toThrow(/PORT/);
    expect(() =>
      loadEnv({
        DATABASE_URL: 'postgresql://x',
        JWT_SECRET: 'test-secret',
        FX_PROVIDER_URL: 'not-a-url',
      }),
    ).toThrow(/FX_PROVIDER_URL/);
  });
});
