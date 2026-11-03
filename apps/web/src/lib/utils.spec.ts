import { describe, expect, it } from 'vitest';
import { cn } from './utils';

const hidden = Number('0');

describe('cn', () => {
    it('joins truthy class names and drops falsy ones', () => {
        expect(cn('a', hidden && 'b', undefined, null, 'c')).toBe('a c');
    });

    it('lets the last conflicting Tailwind utility win', () => {
        expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
        expect(cn('text-sm', { 'text-lg': true })).toBe('text-lg');
    });
});
