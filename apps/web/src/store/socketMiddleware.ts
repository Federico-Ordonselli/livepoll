import type { Middleware, ThunkDispatch, UnknownAction } from '@reduxjs/toolkit'
import type { Socket } from 'socket.io-client'
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@livepoll/shared'
import { api } from './api'
import {
  connectionChanged,
  pollClosed,
  presenceChanged,
  resultsUpdated,
  stateReceived,
  unwatchPoll,
  watchPoll,
} from './pollSlice'

export type PollSocket = Socket<ServerToClientEvents, ClientToServerEvents>

type AppThunkDispatch = ThunkDispatch<unknown, unknown, UnknownAction>

/**
 * Owns the single Socket.io connection. Components only dispatch watchPoll/unwatchPoll;
 * this middleware translates them into room joins and server events into poll-slice actions.
 * The socket is created by an injected factory so tests can pass a fake one.
 */
export function createSocketMiddleware(
  createSocket: () => PollSocket
): Middleware<object, unknown, AppThunkDispatch> {
  return (store) => {
    let socket: PollSocket | null = null
    let currentSlug: string | null = null
    let connectedBefore = false

    function getSocket(): PollSocket {
      if (socket) return socket
      const s = createSocket()

      s.on('connect', () => {
        store.dispatch(connectionChanged('connected'))
        if (currentSlug) {
          s.emit(CLIENT_EVENTS.join, { slug: currentSlug })
          // After a reconnect we may have missed votes or a close, and poll:state has no myVote.
          if (connectedBefore) {
            store.dispatch(
              api.endpoints.getPoll.initiate(currentSlug, { subscribe: false, forceRefetch: true })
            )
          }
        }
        connectedBefore = true
      })
      s.on('disconnect', () => store.dispatch(connectionChanged('disconnected')))
      s.on('connect_error', () => store.dispatch(connectionChanged('disconnected')))

      s.on(SERVER_EVENTS.state, (payload) => store.dispatch(stateReceived(payload)))
      s.on(SERVER_EVENTS.updated, (payload) => store.dispatch(resultsUpdated(payload)))
      s.on(SERVER_EVENTS.closed, (payload) => store.dispatch(pollClosed(payload)))
      s.on(SERVER_EVENTS.presence, (payload) => store.dispatch(presenceChanged(payload)))

      socket = s
      return s
    }

    return (next) => (action) => {
      const result = next(action)

      if (watchPoll.match(action)) {
        const s = getSocket()
        if (currentSlug && currentSlug !== action.payload && s.connected) {
          s.emit(CLIENT_EVENTS.leave, { slug: currentSlug })
        }
        currentSlug = action.payload
        if (s.connected) {
          s.emit(CLIENT_EVENTS.join, { slug: action.payload })
        } else {
          // The 'connect' handler joins currentSlug once the connection is up.
          store.dispatch(connectionChanged('connecting'))
          s.connect()
        }
      }

      if (unwatchPoll.match(action) && action.payload === currentSlug) {
        currentSlug = null
        if (socket?.connected) socket.emit(CLIENT_EVENTS.leave, { slug: action.payload })
      }

      return result
    }
  }
}
