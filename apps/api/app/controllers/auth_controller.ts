import type { HttpContext } from '@adonisjs/core/http'
import type { AuthResponse } from '@livepoll/shared'
import { currentUser } from '#middleware/auth_middleware'
import { toUserDTO } from '#models/user'
import { registerUser, verifyCredentials } from '#services/auth_service'
import { endSession, startSession } from '#services/session'
import { credentialsValidator } from '#validators/auth'

export default class AuthController {
  async register(ctx: HttpContext) {
    // Body only: `validateUsing` would also read the query string, and
    // credentials must never travel in a URL (it ends up in access logs).
    const { email, password } = await credentialsValidator.validate(ctx.request.body())
    const user = await registerUser(email, password)
    startSession(ctx, user._id.toString())
    return ctx.response.created({ user: toUserDTO(user) } satisfies AuthResponse)
  }

  async login(ctx: HttpContext) {
    const { email, password } = await credentialsValidator.validate(ctx.request.body())
    const user = await verifyCredentials(email, password)
    startSession(ctx, user._id.toString())
    return { user: toUserDTO(user) } satisfies AuthResponse
  }

  async logout(ctx: HttpContext) {
    endSession(ctx)
    return ctx.response.noContent()
  }

  async me(ctx: HttpContext) {
    return { user: toUserDTO(currentUser(ctx)) } satisfies AuthResponse
  }
}
