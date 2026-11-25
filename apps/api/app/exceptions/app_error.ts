import type { ErrorCode } from '@livepoll/shared'

/**
 * A known, client-facing error. The exception handler turns it into
 * `{ error: { code, message } }` with the given HTTP status.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string
  ) {
    super(message)
  }

  static notFound(message = 'Not found') {
    return new AppError(404, 'NOT_FOUND', message)
  }

  static unauthenticated() {
    return new AppError(401, 'UNAUTHENTICATED', 'You need to log in')
  }

  static forbidden(message = 'You are not allowed to do this') {
    return new AppError(403, 'FORBIDDEN', message)
  }
}

/** MongoDB duplicate key error (unique index violation). */
export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000
}
