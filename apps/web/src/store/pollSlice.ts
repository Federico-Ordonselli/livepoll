import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type {
  PollClosedPayload,
  PollDTO,
  PollPresencePayload,
  PollStatePayload,
  PollUpdatedPayload,
} from '@livepoll/shared'
import { api } from './api'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

/** Live state of the poll currently on screen. */
export interface PollState {
  slug: string | null
  poll: PollDTO | null
  myVote: string | null
  /**
   * True once a REST response told us this voter's vote. Until then the vote
   * form stays disabled: voting before the first GET has set the voter cookie
   * could create two voter identities for one tab.
   */
  myVoteKnown: boolean
  /** Bumped on every successful vote; reads started before it must not overwrite myVote. */
  voteVersion: number
  /** In-flight GET /polls/:slug requests → voteVersion when they started. */
  pendingReads: Record<string, number>
  viewers: number
  connection: ConnectionStatus
}

const initialState: PollState = {
  slug: null,
  poll: null,
  myVote: null,
  myVoteKnown: false,
  voteVersion: 0,
  pendingReads: {},
  viewers: 0,
  connection: 'idle',
}

export const pollSlice = createSlice({
  name: 'poll',
  initialState,
  reducers: {
    watchPoll(state, action: PayloadAction<string>) {
      // The connection belongs to the socket, not to the poll, so it survives a poll change.
      if (state.slug !== action.payload) {
        return {
          ...initialState,
          slug: action.payload,
          connection: state.connection,
          pendingReads: state.pendingReads,
        }
      }
    },
    unwatchPoll(state, action: PayloadAction<string>) {
      if (state.slug === action.payload) {
        return { ...initialState, connection: state.connection, pendingReads: state.pendingReads }
      }
    },
    stateReceived(state, action: PayloadAction<PollStatePayload>) {
      if (action.payload.poll.slug === state.slug)
        state.poll = keepClosed(state.poll, action.payload.poll)
    },
    resultsUpdated(state, action: PayloadAction<PollUpdatedPayload>) {
      const { slug, options, totalVotes } = action.payload
      if (slug !== state.slug || !state.poll) return
      const votesById = new Map(options.map((option) => [option.id, option.votes]))
      for (const option of state.poll.options) {
        option.votes = votesById.get(option.id) ?? option.votes
      }
      state.poll.totalVotes = totalVotes
    },
    pollClosed(state, action: PayloadAction<PollClosedPayload>) {
      if (action.payload.slug === state.slug && state.poll) state.poll.status = 'closed'
    },
    presenceChanged(state, action: PayloadAction<PollPresencePayload>) {
      if (action.payload.slug === state.slug) state.viewers = action.payload.count
    },
    connectionChanged(state, action: PayloadAction<ConnectionStatus>) {
      state.connection = action.payload
    },
  },
  extraReducers: (builder) => {
    const { getPoll, vote } = api.endpoints
    builder
      .addMatcher(getPoll.matchPending, (state, action) => {
        state.pendingReads[action.meta.requestId] = state.voteVersion
      })
      .addMatcher(getPoll.matchRejected, (state, action) => {
        forgetRead(state, action.meta.requestId)
      })
      .addMatcher(getPoll.matchFulfilled, (state, action) => {
        const startedAt = forgetRead(state, action.meta.requestId)
        if (action.payload.poll.slug !== state.slug) return
        state.poll = keepClosed(state.poll, action.payload.poll)
        // A read that started before our latest vote carries an outdated myVote.
        if (startedAt === undefined || startedAt === state.voteVersion) {
          state.myVote = action.payload.myVote
          state.myVoteKnown = true
        }
      })
      .addMatcher(vote.matchFulfilled, (state, action) => {
        if (action.payload.poll.slug !== state.slug) return
        state.poll = keepClosed(state.poll, action.payload.poll)
        state.myVote = action.payload.myVote
        state.myVoteKnown = true
        state.voteVersion += 1
      })
  },
})

/** Removes a finished read and returns the voteVersion it started at. */
function forgetRead(state: PollState, requestId: string): number | undefined {
  const { [requestId]: startedAt, ...rest } = state.pendingReads
  state.pendingReads = rest
  return startedAt
}

/**
 * A poll never re-opens. A REST response that was read before the poll closed
 * can arrive after the live `poll:closed` event; it must not flip it back to open.
 */
function keepClosed(current: PollDTO | null, incoming: PollDTO): PollDTO {
  if (current?.status === 'closed' && incoming.status === 'open') {
    return { ...incoming, status: 'closed', closedAt: current.closedAt }
  }
  return incoming
}

export const {
  watchPoll,
  unwatchPoll,
  stateReceived,
  resultsUpdated,
  pollClosed,
  presenceChanged,
  connectionChanged,
} = pollSlice.actions
