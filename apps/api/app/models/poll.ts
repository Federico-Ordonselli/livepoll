import { Schema, model, type Types } from 'mongoose'
import type { PollDTO, PollStatus } from '@livepoll/shared'

export interface PollOptionAttrs {
  _id: Types.ObjectId
  label: string
  /** Denormalized counter, only ever changed with $inc. */
  votes: number
}

export interface PollAttrs {
  _id: Types.ObjectId
  slug: string
  ownerId: Types.ObjectId
  question: string
  options: PollOptionAttrs[]
  allowVoteChange: boolean
  status: PollStatus
  /** Denormalized counter, only ever changed with $inc. */
  totalVotes: number
  createdAt: Date
  closedAt: Date | null
}

const optionSchema = new Schema<PollOptionAttrs>({
  label: { type: String, required: true },
  votes: { type: Number, required: true, default: 0 },
})

const pollSchema = new Schema<PollAttrs>(
  {
    slug: { type: String, required: true, unique: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true },
    options: { type: [optionSchema], required: true },
    allowVoteChange: { type: Boolean, required: true, default: false },
    status: { type: String, enum: ['open', 'closed'], required: true, default: 'open' },
    totalVotes: { type: Number, required: true, default: 0 },
    closedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

// Dashboard query: a creator's polls, newest first.
pollSchema.index({ ownerId: 1, createdAt: -1 })

export const Poll = model<PollAttrs>('Poll', pollSchema)

export function toPollDTO(poll: PollAttrs): PollDTO {
  return {
    id: poll._id.toString(),
    slug: poll.slug,
    question: poll.question,
    options: poll.options.map((option) => ({
      id: option._id.toString(),
      label: option.label,
      votes: option.votes,
    })),
    allowVoteChange: poll.allowVoteChange,
    status: poll.status,
    totalVotes: poll.totalVotes,
    createdAt: poll.createdAt.toISOString(),
    closedAt: poll.closedAt ? poll.closedAt.toISOString() : null,
  }
}
