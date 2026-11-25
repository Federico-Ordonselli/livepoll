import { isValidObjectId } from 'mongoose'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { AppError } from '#exceptions/app_error'
import { User, type UserAttrs } from '#models/user'
import { readSession } from '#services/session'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    user?: UserAttrs
  }
}

/** Loads the logged-in user from the session cookie, or responds 401. */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const userId = readSession(ctx)
    if (!userId || !isValidObjectId(userId)) throw AppError.unauthenticated()

    const user = await User.findById(userId).lean()
    if (!user) throw AppError.unauthenticated()

    ctx.user = user
    return next()
  }
}

/** For handlers behind the auth middleware. */
export function currentUser(ctx: HttpContext): UserAttrs {
  if (!ctx.user) throw AppError.unauthenticated()
  return ctx.user
}
