import { Schema, model, type Types } from 'mongoose'

export interface VoteAttrs {
  _id: Types.ObjectId
  pollId: Types.ObjectId
  voterId: string
  optionId: Types.ObjectId
  createdAt: Date
}

const voteSchema = new Schema<VoteAttrs>(
  {
    pollId: { type: Schema.Types.ObjectId, ref: 'Poll', required: true },
    voterId: { type: String, required: true },
    optionId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

/**
 * THE rule of the app: one vote per voter per poll. MongoDB enforces it
 * atomically, so two parallel requests can never both insert.
 */
voteSchema.index({ pollId: 1, voterId: 1 }, { unique: true })

export const Vote = model<VoteAttrs>('Vote', voteSchema)
