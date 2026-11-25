import type { ApiErrorBody, ErrorCode, FieldError } from '@livepoll/shared'

export interface ParsedApiError {
  status: number | null
  code: ErrorCode | null
  message: string
  details: FieldError[]
}

function isApiErrorBody(data: unknown): data is ApiErrorBody {
  return typeof data === 'object' && data !== null && 'error' in data
}

/** Turns an RTK Query error (HTTP error with our body, or network failure) into something renderable. */
export function parseApiError(error: unknown): ParsedApiError {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = typeof error.status === 'number' ? error.status : null
    const data = 'data' in error ? error.data : undefined
    if (isApiErrorBody(data)) {
      const { code, message, details = [] } = data.error
      return { status, code, message, details }
    }
    if (status !== null) {
      return { status, code: null, message: `Request failed (${status}).`, details: [] }
    }
  }
  return {
    status: null,
    code: null,
    message: 'Could not reach the server. Check your connection and try again.',
    details: [],
  }
}
