import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const schema = z.object({ members: z.array(z.object({ name: z.string() })) });

describe('ZodValidationPipe', () => {
    const pipe = new ZodValidationPipe(schema);

    it('returns parsed data when valid', () => {
        expect(pipe.transform({ members: [{ name: 'Ana' }] })).toEqual({
            members: [{ name: 'Ana' }],
        });
    });

    it('throws 422 VALIDATION_ERROR with details', () => {
        try {
            pipe.transform({ members: [{ name: 'Ana' }, {}] });

            throw new Error('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(AppError);
            const appError = error as AppError;

            expect(appError.statusCode).toBe(422);
            expect(appError.code).toBe('VALIDATION_ERROR');
            expect(appError.details).toHaveLength(1);
            expect(appError.details?.[0]?.path).toBe('members.1.name');
        }
    });
});
