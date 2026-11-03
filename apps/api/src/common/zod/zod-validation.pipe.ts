import { type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
    constructor(private readonly schema: ZodType<T>) {}

    transform(value: unknown): T {
        const result = this.schema.safeParse(value);

        if (result.success) return result.data;

        throw new AppError(
            'VALIDATION_ERROR',
            422,
            'Invalid request data',
            result.error.issues.map((issue) => ({
                path: issue.path.map(String).join('.'),
                message: issue.message,
            })),
        );
    }
}
