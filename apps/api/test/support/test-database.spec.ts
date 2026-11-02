import { describe, expect, it } from 'vitest';
import {
  EXAMPLE_DATABASE_URL,
  resolveTestDatabaseUrl,
  UnsafeTestDatabaseError,
} from './test-database.js';

const resolve = (url: string | undefined) => resolveTestDatabaseUrl({ DATABASE_URL: url });

describe('resolveTestDatabaseUrl', () => {
  it.each([
    'postgresql://splitgo:splitgo@localhost:5432/splitgo',
    'postgresql://u:p@127.0.0.1:55432/splitgo_test',
    'postgres://u:p@[::1]:5432/app_test',
    'postgresql://u:p@postgres:5432/splitgo',
    'postgresql://u:p@db:5432/splitgo?schema=public',
    EXAMPLE_DATABASE_URL,
  ])('accepts %s', (url) => {
    expect(resolve(url)).toBe(url);
  });

  it('rejects a missing or blank DATABASE_URL (there is no default)', () => {
    expect(() => resolveTestDatabaseUrl({})).toThrow(UnsafeTestDatabaseError);
    expect(() => resolve('')).toThrow(/not set/);
    expect(() => resolve('   ')).toThrow(/not set/);
  });

  it.each([
    'postgresql://u:p@db.example.com:5432/splitgo',
    'postgresql://u:p@10.0.0.5:5432/splitgo',
    'postgresql://u:p@localhost.evil.com:5432/splitgo',
    'postgresql://u:p@prod-db:5432/splitgo',
  ])('rejects remote host %s', (url) => {
    expect(() => resolve(url)).toThrow(/not a local or test host/);
  });

  it('rejects malformed URLs and other protocols', () => {
    expect(() => resolve('not a url')).toThrow(/not a valid URL/);
    expect(() => resolve('mysql://u:p@localhost/splitgo')).toThrow(/protocol/);
    expect(() => resolve('http://localhost/splitgo')).toThrow(/protocol/);
  });

  it('rejects missing or production-looking database names', () => {
    expect(() => resolve('postgresql://u:p@localhost:5432')).toThrow(/no database name/);
    for (const name of ['production', 'splitgo_prod', 'prod', 'live', 'staging']) {
      expect(() => resolve(`postgresql://u:p@localhost:5432/${name}`)).toThrow(/production/);
    }
  });

  it('never prints credentials or the raw URL in error messages', () => {
    const secrets = [
      'postgresql://admin:hunter2secret@db.example.com:5432/splitgo',
      'postgresql://admin:hunter2secret@localhost:5432/production',
      'mysql://admin:hunter2secret@localhost/splitgo',
      'hunter2secret not a url',
    ];
    for (const url of secrets) {
      const message = (() => {
        try {
          resolve(url);
          return '';
        } catch (error) {
          return (error as Error).message;
        }
      })();
      expect(message).not.toBe('');
      expect(message).not.toContain('hunter2secret');
      expect(message).not.toContain('admin');
      expect(message).toContain('DATABASE_URL=');
    }
  });
});
