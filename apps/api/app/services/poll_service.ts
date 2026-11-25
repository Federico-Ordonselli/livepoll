import { randomBytes } from 'node:crypto'
import { Types } from 'mongoose'
import type { PollWithVoteResponse } from '@livepoll/shared'
import { AppError, isDuplicateKeyError } from '#exceptions/app_error'
import { Poll, type PollAttrs } from '#models/poll'
import { Vote } from '#models/vote'

export interface CreatePollData {
  question: string
  options: string[]
  allowVoteChange?: boolean
}

/** 6 random bytes → 8 URL-safe characters (48 bits, ~2.8e14 possibilities). */
export function generateSlug(): string {
  return randomBytes(6).toString('base64url')
}

export async function createPoll(ownerId: Types.ObjectId, data: CreatePollData) {
  // A slug collision is astronomically unlikely, but the unique index makes it safe to retry.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const poll = await Poll.create({
        slug: generateSlug(),
        ownerId,
        question: data.question,
        options: data.options.map((label) => ({ label, votes: 0 })),
        allowVoteChange: data.allowVoteChange ?? false,
      })
      return poll.toObject()
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error
    }
  }
  throw new Error('Could not generate a unique slug')
}

export function listPollsOf(ownerId: Types.ObjectId) {
  return Poll.find({ ownerId }).sort({ createdAt: -1 }).lean()
}

export async function findPollOrFail(slug: string): Promise<PollAttrs> {
  const poll = await Poll.findOne({ slug }).lean()
  if (!poll) throw AppError.notFound('Poll not found')
  return poll
}

export async function myVoteFor(pollId: Types.ObjectId, voterId: string): Promise<string | null> {
  const vote = await Vote.findOne({ pollId, voterId }).lean()
  return vote ? vote.optionId.toString() : null
}

export async function getPollForVoter(
  slug: string,
  voterId: string
): Promise<{ poll: PollAttrs; myVote: PollWithVoteResponse['myVote'] }> {
  const poll = await findPollOrFail(slug)
  return { poll, myVote: await myVoteFor(poll._id, voterId) }
}

/** Closes a poll. Only the owner may do it; closing twice is a harmless no-op. */
export async function closePoll(slug: string, userId: Types.ObjectId): Promise<PollAttrs> {
  const poll = await findPollOrFail(slug)
  if (!poll.ownerId.equals(userId)) throw AppError.forbidden('Only the creator can close this poll')
  if (poll.status === 'closed') return poll

  const closed = await Poll.findOneAndUpdate(
    { _id: poll._id, status: 'open' },
    { $set: { status: 'closed', closedAt: new Date() } },
    { new: true }
  ).lean()

  return closed ?? (await findPollOrFail(slug))
}
