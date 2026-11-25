import { errors as vineErrors } from '@vinejs/vine'
import { errors as limiterErrors } from '@adonisjs/limiter'
import { ExceptionHandler, type HttpContext } from '@adonisjs/core/http'
import type { ApiErrorBody, ErrorCode, FieldError } from '@livepoll/shared'
import { AppError } from '#exceptions/app_error'

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'VALIDATION_ERROR',
  415: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
}

/**
 * Turns every error into `{ error: { code, message } }`. Unknown errors become
 * a generic 500: stack traces and internal messages never reach the client.
 */
export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = false

  async handle(error: unknown, ctx: HttpContext) {
    const { status, body } = this.toErrorResponse(error)
    if (error instanceof limiterErrors.E_TOO_MANY_REQUESTS) {
      ctx.response.header('Retry-After', String(error.response.availableIn))
    }
    return ctx.response.status(status).send(body)
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }

  protected toErrorResponse(error: unknown): { status: number; body: ApiErrorBody } {
    if (error instanceof AppError) {
      return reply(error.status, error.code, error.message)
    }

    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      const details: FieldError[] = (error.messages as { field: string; message: string }[]).map(
        ({ field, message }) => ({ field, message })
      )
      return reply(422, 'VALIDATION_ERROR', 'The request is invalid', details)
    }

    if (error instanceof limiterErrors.E_TOO_MANY_REQUESTS) {
      return reply(429, 'RATE_LIMITED', 'Too many requests, please slow down')
    }

    // Framework errors with a 4xx status (route not found, malformed JSON, ...).
    const status = statusOf(error)
    const code = status ? CODE_BY_STATUS[status] : undefined
    if (status && code) {
      return reply(status, code, status === 404 ? 'Not found' : 'Bad request')
    }

    return reply(500, 'INTERNAL_ERROR', 'Something went wrong')
  }
}

function statusOf(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    return typeof error.status === 'number' ? error.status : undefined
  }
  return undefined
}

function reply(status: number, code: ErrorCode, message: string, details?: FieldError[]) {
  const body: ApiErrorBody = { error: details ? { code, message, details } : { code, message } }
  return { status, body }
}
