import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Helmet-style headers for a JSON-only API. (@adonisjs/shield is built
 * around server-rendered pages + sessions; these few headers are all a JSON
 * API needs.)
 */
export default class SecurityHeadersMiddleware {
  async handle({ response }: HttpContext, next: NextFn) {
    response.header('X-Content-Type-Options', 'nosniff')
    response.header('X-Frame-Options', 'DENY')
    response.header('Referrer-Policy', 'no-referrer')
    response.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
    response.header('Cross-Origin-Resource-Policy', 'same-site')
    if (app.inProduction) {
      response.header('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
    }
    return next()
  }
}
