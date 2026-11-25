import type { HttpContext } from '@adonisjs/core/http'
import { cookieSecure } from '#config/app'

/**
 * Stateless session: a signed, httpOnly cookie holding the user id and an
 * expiry. The signature (APP_KEY) prevents tampering; the embedded `exp`
 * enforces the lifetime server-side, independent of the browser.
 */
const COOKIE_NAME = 'lp_session'
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60

interface SessionPayload {
  uid: string
  exp: number
}

export function startSession(ctx: HttpContext, userId: string) {
  const payload: SessionPayload = { uid: userId, exp: Date.now() + MAX_AGE_SECONDS * 1000 }
  ctx.response.cookie(COOKIE_NAME, payload, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

/** Returns the user id from a valid, unexpired session cookie, or null. */
export function readSession(ctx: HttpContext): string | null {
  const value: unknown = ctx.request.cookie(COOKIE_NAME)
  if (typeof value !== 'object' || value === null) return null
  const { uid, exp } = value as Partial<SessionPayload>
  if (typeof uid !== 'string' || typeof exp !== 'number' || exp < Date.now()) return null
  return uid
}

export function endSession(ctx: HttpContext) {
  ctx.response.clearCookie(COOKIE_NAME, { path: '/' })
}
