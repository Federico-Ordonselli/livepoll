import type { PollDTO } from './types.js'

/**
 * Socket.io contract. Sockets are read-only for data: clients only join/leave
 * rooms, all writes go through the REST API.
 */
export const CLIENT_EVENTS = {
  join: 'poll:join',
  leave: 'poll:leave',
} as const

export const SERVER_EVENTS = {
  state: 'poll:state',
  updated: 'poll:updated',
  closed: 'poll:closed',
  presence: 'poll:presence',
} as const

/** Name of the Socket.io room for a poll. */
export const pollRoom = (slug: string): string => `poll:${slug}`

export interface PollJoinPayload {
  slug: string
}

export interface PollLeavePayload {
  slug: string
}

export interface PollStatePayload {
  poll: PollDTO
}

export interface PollUpdatedPayload {
  slug: string
  options: { id: string; votes: number }[]
  totalVotes: number
}

export interface PollClosedPayload {
  slug: string
}

export interface PollPresencePayload {
  slug: string
  count: number
}

/** Typed maps for `new Server<ClientToServerEvents, ServerToClientEvents>()` and `io()`. */
export interface ClientToServerEvents {
  'poll:join': (payload: PollJoinPayload) => void
  'poll:leave': (payload: PollLeavePayload) => void
}

export interface ServerToClientEvents {
  'poll:state': (payload: PollStatePayload) => void
  'poll:updated': (payload: PollUpdatedPayload) => void
  'poll:closed': (payload: PollClosedPayload) => void
  'poll:presence': (payload: PollPresencePayload) => void
}
