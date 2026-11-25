import { createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit'
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
  viewers: number
  connection: ConnectionStatus
}

const initialState: PollState = {
  slug: null,
  poll: null,
  myVote: null,
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
        return { ...initialState, slug: action.payload, connection: state.connection }
      }
    },
    unwatchPoll(state, action: PayloadAction<string>) {
      if (state.slug === action.payload) {
        return { ...initialState, connection: state.connection }
      }
    },
    stateReceived(state, action: PayloadAction<PollStatePayload>) {
      if (action.payload.poll.slug === state.slug) state.poll = action.payload.poll
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
    builder.addMatcher(
      isAnyOf(api.endpoints.getPoll.matchFulfilled, api.endpoints.vote.matchFulfilled),
      (state, action) => {
        if (action.payload.poll.slug !== state.slug) return
        state.poll = action.payload.poll
        state.myVote = action.payload.myVote
      }
    )
  },
})

export const {
  watchPoll,
  unwatchPoll,
  stateReceived,
  resultsUpdated,
  pollClosed,
  presenceChanged,
  connectionChanged,
} = pollSlice.actions
