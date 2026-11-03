import type { ErrorCode } from './error-codes.js';

export interface ErrorDetail {
    path: string;
    message: string;
}

export class AppError extends Error {
    constructor(
        readonly code: ErrorCode,
        readonly statusCode: number,
        message: string = code,
        readonly details?: ErrorDetail[],
    ) {
        super(message);
        this.name = 'AppError';
    }
}
