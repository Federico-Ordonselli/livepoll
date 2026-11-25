import { z } from 'zod'
import { LIMITS, SLUG_PATTERN } from './constants.js'

/*
 * zod schemas used by the web app (form validation) and by the API's
 * Socket.io handlers (payload validation). The HTTP API validates with
 * VineJS using the same LIMITS, see apps/api/app/validators.
 */

export const emailSchema = z.string().trim().toLowerCase().max(LIMITS.emailMax).pipe(z.email())

export const passwordSchema = z.string().min(LIMITS.passwordMin).max(LIMITS.passwordMax)

export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})
export type CredentialsInput = z.infer<typeof credentialsSchema>

export const createPollSchema = z.object({
  question: z.string().trim().min(LIMITS.questionMin).max(LIMITS.questionMax),
  options: z
    .array(z.string().trim().min(LIMITS.optionLabelMin).max(LIMITS.optionLabelMax))
    .min(LIMITS.optionsMin)
    .max(LIMITS.optionsMax),
  allowVoteChange: z.boolean().default(false),
})
export type CreatePollInput = z.input<typeof createPollSchema>

export const voteSchema = z.object({
  optionId: z.string().min(1),
})
export type VoteInput = z.infer<typeof voteSchema>

export const slugSchema = z.string().regex(SLUG_PATTERN)

export const pollRoomPayloadSchema = z.object({ slug: slugSchema })
