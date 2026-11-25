import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { allowedOrigins } from '#config/origins'
import { AppError } from '#exceptions/app_error'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defence for state-changing requests. Browsers always send `Origin`
 * on cross-origin POSTs, so a POST from a page that is not on the allow-list
 * is rejected before any handler runs. Requests without `Origin` come from
 * non-browser clients, which cannot carry a victim's cookies anyway.
 */
export default class OriginCheckMiddleware {
  async handle({ request }: HttpContext, next: NextFn) {
    const origin = request.header('origin')
    if (!SAFE_METHODS.has(request.method()) && origin && !allowedOrigins.includes(origin)) {
      throw AppError.forbidden('Cross-origin request blocked')
    }
    return next()
  }
}
