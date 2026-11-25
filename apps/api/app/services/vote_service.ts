import type { Types } from 'mongoose'
import { AppError, isDuplicateKeyError } from '#exceptions/app_error'
import { Poll, type PollAttrs } from '#models/poll'
import { Vote } from '#models/vote'
import realtime from '#services/realtime'
import { findPollOrFail } from '#services/poll_service'

/**
 * How votes stay correct without a transaction
 * --------------------------------------------
 * 1. The `votes` collection is the source of truth. Its unique index on
 *    (pollId, voterId) guarantees one vote per voter, even under races.
 * 2. Counters on the poll are derived data, changed only with `$inc` after
 *    the vote document was written. `$inc` is atomic and commutative, so
 *    parallel requests can apply in any order and still sum correctly.
 * 3. Changing a vote is a compare-and-swap on the vote document
 *    (`{ optionId: old } → { optionId: new }`). Only one of several parallel
 *    changes can win each swap; losers re-read and retry.
 *
 * The open/closed check happens when the request starts: a vote that passed
 * it a few milliseconds before the poll was closed is still counted.
 */
const MAX_CHANGE_ATTEMPTS = 10

export interface VoteResult {
  poll: PollAttrs
  myVote: string
}

export async function castVote(slug: string, voterId: string, optionId: string) {
  const poll = await findPollOrFail(slug)
  if (poll.status === 'closed') throw pollClosed()

  const option = poll.options.find((o) => o._id.toString() === optionId)
  if (!option) throw new AppError(422, 'INVALID_OPTION', 'This option does not belong to the poll')

  let result: VoteResult
  try {
    await Vote.create({ pollId: poll._id, voterId, optionId: option._id })
    result = { poll: await applyCounts(poll._id, option._id, null), myVote: optionId }
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
    if (!poll.allowVoteChange) {
      throw new AppError(409, 'ALREADY_VOTED', 'You have already voted in this poll')
    }
    result = await changeVote(poll, voterId, option._id)
  }

  realtime.pollUpdated(slug)
  return result
}

async function changeVote(
  poll: PollAttrs,
  voterId: string,
  to: Types.ObjectId
): Promise<VoteResult> {
  for (let attempt = 0; attempt < MAX_CHANGE_ATTEMPTS; attempt++) {
    const current = await Vote.findOne({ pollId: poll._id, voterId }).lean()
    if (!current) break // cannot happen today (votes are never deleted); fail safe
    const from = current.optionId
    if (from.equals(to)) {
      return { poll: await findPollOrFail(poll.slug), myVote: to.toString() }
    }

    // Compare-and-swap: succeeds only if nobody changed this vote since we read it.
    const swapped = await Vote.updateOne(
      { _id: current._id, optionId: from },
      { $set: { optionId: to } }
    )
    if (swapped.modifiedCount === 1) {
      return { poll: await applyCounts(poll._id, to, from), myVote: to.toString() }
    }
  }
  throw new AppError(409, 'CONFLICT', 'Your vote was changed concurrently, please retry')
}

/** +1 on `to` (and -1 on `from` for a vote change) in one atomic update. */
async function applyCounts(
  pollId: Types.ObjectId,
  to: Types.ObjectId,
  from: Types.ObjectId | null
): Promise<PollAttrs> {
  const inc: Record<string, number> = { 'options.$[to].votes': 1 }
  const arrayFilters: Record<string, Types.ObjectId>[] = [{ 'to._id': to }]
  if (from) {
    inc['options.$[from].votes'] = -1
    arrayFilters.push({ 'from._id': from })
  } else {
    inc.totalVotes = 1
  }

  const updated = await Poll.findOneAndUpdate(
    { _id: pollId },
    { $inc: inc },
    { new: true, arrayFilters }
  ).lean()
  if (!updated) throw AppError.notFound('Poll not found')
  return updated
}

function pollClosed() {
  return new AppError(409, 'POLL_CLOSED', 'This poll is closed')
}
