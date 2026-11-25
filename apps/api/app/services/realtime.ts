import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import logger from '@adonisjs/core/services/logger'
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  pollRoom,
  pollRoomPayloadSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@livepoll/shared'
import { Poll, toPollDTO } from '#models/poll'

type IO = Server<ClientToServerEvents, ServerToClientEvents>
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>

/**
 * Socket.io layer. Read-only for clients: they can join/leave a poll room and
 * receive updates. Every write goes through the REST API, which then calls
 * `pollUpdated` / `pollClosed` here.
 */
export class RealtimeService {
  #io: IO | null = null
  /** Slugs whose broadcast is running, and slugs that changed meanwhile. */
  #inFlight = new Set<string>()
  #dirty = new Set<string>()

  get io(): IO | null {
    return this.#io
  }

  attach(httpServer: HttpServer, allowedOrigins: string[]) {
    if (this.#io) return
    this.#io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
      cors: { origin: allowedOrigins, credentials: true },
      serveClient: false,
    })
    this.#io.on('connection', (socket) => this.#onConnection(socket))
  }

  async close() {
    if (!this.#io) return
    // Disconnect clients but leave closing the HTTP server to AdonisJS.
    this.#io.disconnectSockets(true)
    this.#io.engine.close()
    this.#io = null
  }

  /**
   * Broadcast fresh counts after a vote. Bursts are coalesced: while one
   * broadcast is reading from MongoDB, further calls only mark the poll dirty
   * and trigger one more read afterwards. Reads are sequential, so clients
   * never receive an older snapshot after a newer one.
   */
  pollUpdated(slug: string) {
    if (!this.#io) return
    if (this.#inFlight.has(slug)) {
      this.#dirty.add(slug)
      return
    }
    this.#inFlight.add(slug)
    void this.#flushUpdates(slug)
  }

  pollClosed(slug: string) {
    this.#io?.to(pollRoom(slug)).emit(SERVER_EVENTS.closed, { slug })
  }

  async #flushUpdates(slug: string) {
    try {
      do {
        this.#dirty.delete(slug)
        const poll = await Poll.findOne({ slug }, { options: 1, totalVotes: 1 }).lean()
        if (!poll || !this.#io) break
        this.#io.to(pollRoom(slug)).emit(SERVER_EVENTS.updated, {
          slug,
          options: poll.options.map((o) => ({ id: o._id.toString(), votes: o.votes })),
          totalVotes: poll.totalVotes,
        })
      } while (this.#dirty.has(slug))
    } catch (error) {
      logger.error({ err: error, slug }, 'failed to broadcast poll update')
    } finally {
      this.#inFlight.delete(slug)
      this.#dirty.delete(slug)
    }
  }

  #onConnection(socket: ClientSocket) {
    socket.on(CLIENT_EVENTS.join, async (payload) => {
      const parsed = pollRoomPayloadSchema.safeParse(payload)
      if (!parsed.success) return
      const { slug } = parsed.data

      try {
        const poll = await Poll.findOne({ slug }).lean()
        if (!poll) return

        // A client watches one poll at a time: leaving other rooms keeps the
        // UI model simple and stops a single socket from joining thousands of rooms.
        for (const room of socket.rooms) {
          if (room !== socket.id && room !== pollRoom(slug)) await this.#leave(socket, room)
        }
        await socket.join(pollRoom(slug))
        socket.emit(SERVER_EVENTS.state, { poll: toPollDTO(poll) })
        await this.#broadcastPresence(slug)
      } catch (error) {
        logger.error({ err: error, slug }, 'poll:join failed')
      }
    })

    socket.on(CLIENT_EVENTS.leave, async (payload) => {
      const parsed = pollRoomPayloadSchema.safeParse(payload)
      if (!parsed.success) return
      await this.#leave(socket, pollRoom(parsed.data.slug))
    })

    // While "disconnecting", the socket is still in its rooms; remember them
    // and recount once it has actually left.
    socket.on('disconnecting', () => {
      const rooms = [...socket.rooms].filter((room) => room.startsWith('poll:'))
      socket.once('disconnect', () => {
        for (const room of rooms) void this.#broadcastPresence(room.slice('poll:'.length))
      })
    })
  }

  async #leave(socket: ClientSocket, room: string) {
    if (!socket.rooms.has(room)) return
    await socket.leave(room)
    await this.#broadcastPresence(room.slice('poll:'.length))
  }

  /** "N people viewing" = number of sockets currently in the room. */
  async #broadcastPresence(slug: string) {
    if (!this.#io) return
    const sockets = await this.#io.in(pollRoom(slug)).fetchSockets()
    this.#io.to(pollRoom(slug)).emit(SERVER_EVENTS.presence, { slug, count: sockets.length })
  }
}

const realtime = new RealtimeService()
export default realtime
