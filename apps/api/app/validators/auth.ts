import vine from '@vinejs/vine'
import { LIMITS } from '@livepoll/shared'

/** Mirrors `credentialsSchema` in @livepoll/shared. */
export const credentialsValidator = vine.compile(
  vine.object({
    email: vine
      .string()
      .trim()
      .toLowerCase()
      .maxLength(LIMITS.emailMax)
      .email({ allow_utf8_local_part: false }),
    password: vine.string().minLength(LIMITS.passwordMin).maxLength(LIMITS.passwordMax),
  })
)
