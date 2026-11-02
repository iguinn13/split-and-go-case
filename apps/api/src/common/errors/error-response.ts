import type { ErrorCode } from './error-codes.js';
import type { ErrorDetail } from './app-error.js';

export interface ErrorResponse {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
}
