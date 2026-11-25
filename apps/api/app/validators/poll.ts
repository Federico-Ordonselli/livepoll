import vine from '@vinejs/vine'
import { LIMITS } from '@livepoll/shared'

/** Mirrors `createPollSchema` in @livepoll/shared. */
export const createPollValidator = vine.compile(
  vine.object({
    question: vine.string().trim().minLength(LIMITS.questionMin).maxLength(LIMITS.questionMax),
    options: vine
      .array(vine.string().trim().minLength(LIMITS.optionLabelMin).maxLength(LIMITS.optionLabelMax))
      .minLength(LIMITS.optionsMin)
      .maxLength(LIMITS.optionsMax),
    allowVoteChange: vine.boolean().optional(),
  })
)

/** Mirrors `voteSchema` in @livepoll/shared. */
export const voteValidator = vine.compile(
  vine.object({
    optionId: vine.string().trim().minLength(1).maxLength(64),
  })
)
