import { randomUUID } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { cookieSecure } from '#config/app'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    voterId?: string
  }
}

const COOKIE_NAME = 'voter_id'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Anonymous voter identity: a random UUID in a signed, httpOnly cookie.
 * Signed means a client cannot pick someone else's id; httpOnly means page
 * scripts cannot read it. Clearing cookies does give a new identity: that is
 * the accepted limit of anonymous voting (see docs/ARCHITECTURE.md).
 */
export default class VoterMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    let voterId: unknown = ctx.request.cookie(COOKIE_NAME)
    if (typeof voterId !== 'string' || !UUID.test(voterId)) {
      voterId = randomUUID()
      ctx.response.cookie(COOKIE_NAME, voterId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSecure,
        path: '/',
        maxAge: '365d',
      })
    }
    ctx.voterId = voterId as string
    return next()
  }
}

export function currentVoter(ctx: HttpContext): string {
  if (!ctx.voterId) throw new Error('voter middleware is missing on this route')
  return ctx.voterId
}
