import type { HttpContext } from '@adonisjs/core/http'
import type { MyPollsResponse, PollResponse, PollWithVoteResponse } from '@livepoll/shared'
import { currentUser } from '#middleware/auth_middleware'
import { currentVoter } from '#middleware/voter_middleware'
import { toPollDTO } from '#models/poll'
import { closePoll, createPoll, getPollForVoter, listPollsOf } from '#services/poll_service'
import { castVote } from '#services/vote_service'
import { createPollValidator, voteValidator } from '#validators/poll'

export default class PollsController {
  async store(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(createPollValidator)
    const poll = await createPoll(currentUser(ctx)._id, data)
    return ctx.response.created({ poll: toPollDTO(poll) } satisfies PollResponse)
  }

  async mine(ctx: HttpContext) {
    const polls = await listPollsOf(currentUser(ctx)._id)
    return { polls: polls.map(toPollDTO) } satisfies MyPollsResponse
  }

  async show(ctx: HttpContext) {
    const { poll, myVote } = await getPollForVoter(ctx.params.slug, currentVoter(ctx))
    return { poll: toPollDTO(poll), myVote } satisfies PollWithVoteResponse
  }

  async vote(ctx: HttpContext) {
    const { optionId } = await ctx.request.validateUsing(voteValidator)
    const { poll, myVote } = await castVote(ctx.params.slug, currentVoter(ctx), optionId)
    return { poll: toPollDTO(poll), myVote } satisfies PollWithVoteResponse
  }

  async close(ctx: HttpContext) {
    const poll = await closePoll(ctx.params.slug, currentUser(ctx)._id)
    return { poll: toPollDTO(poll) } satisfies PollResponse
  }
}
