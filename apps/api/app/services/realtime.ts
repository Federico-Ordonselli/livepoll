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

/** Per-socket state: the poll this socket most recently asked to watch. */
interface SocketData {
  wantedSlug?: string
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
type ClientSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>

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
    this.#io = new Server<
      ClientToServerEvents,
      ServerToClientEvents,
      Record<string, never>,
      SocketData
    >(httpServer, {
      cors: { origin: allowedOrigins, credentials: true },
      serveClient: false,
      // CORS only covers HTTP long-polling; a browser WebSocket handshake also
      // carries Origin, so check it here for both transports.
      allowRequest: (req, callback) => {
        const origin = req.headers.origin
        callback(null, !origin || allowedOrigins.includes(origin))
      },
    })
    this.#io.on('connection', (socket) => this.#onConnection(socket))
  }

  async close() {
    if (!this.#io) return
    // Close the transports but leave closing the HTTP server to AdonisJS.
    // Clients see a "transport close" and reconnect on their own. (An explicit
    // `disconnectSockets()` would tell them the server kicked them out, and
    // socket.io-client does not auto-reconnect after that.)
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
      const room = pollRoom(slug)
      // The latest request always wins, even if it is for a room we are already in
      // (A → B → A while B is still loading must end in A).
      socket.data.wantedSlug = slug
      if (socket.rooms.has(room)) return

      try {
        // Subscribe BEFORE reading the snapshot: a close or vote broadcast that
        // happens during the read is then delivered, never lost in between.
        await socket.join(room)
        const poll = await Poll.findOne({ slug }).lean()
        // Unknown poll, or the client left / asked for another poll meanwhile.
        if (!poll || socket.data.wantedSlug !== slug || socket.disconnected) {
          await this.#leave(socket, room)
          return
        }

        // A client watches one poll at a time: leaving other rooms keeps the
        // UI model simple and stops a single socket from joining thousands of rooms.
        for (const other of socket.rooms) {
          if (other !== socket.id && other !== room) await this.#leave(socket, other)
        }
        socket.emit(SERVER_EVENTS.state, { poll: toPollDTO(poll) })
        await this.#broadcastPresence(slug)
      } catch (error) {
        logger.error({ err: error, slug }, 'poll:join failed')
      }
    })

    socket.on(CLIENT_EVENTS.leave, async (payload) => {
      const parsed = pollRoomPayloadSchema.safeParse(payload)
      if (!parsed.success) return
      if (socket.data.wantedSlug === parsed.data.slug) socket.data.wantedSlug = undefined
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
