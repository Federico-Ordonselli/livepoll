import { test } from '@japa/runner'
import { io as connect, type Socket } from 'socket.io-client'
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@livepoll/shared'
import env from '#start/env'
import { createPoll, newVoterId, registerUser, resetState, vote } from '#tests/helpers'

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const sockets: ClientSocket[] = []

function client(): Promise<ClientSocket> {
  const socket: ClientSocket = connect(`http://${env.get('HOST')}:${env.get('PORT')}`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  })
  sockets.push(socket)
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', reject)
  })
}

/** Resolves with the next payload of `event` that matches `predicate`. */
function next<E extends keyof ServerToClientEvents>(
  socket: ClientSocket,
  event: E,
  predicate: (payload: Parameters<ServerToClientEvents[E]>[0]) => boolean = () => true,
  timeoutMs = 3000
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeoutMs)
    const handler = (payload: Parameters<ServerToClientEvents[E]>[0]) => {
      if (!predicate(payload)) return
      clearTimeout(timer)
      socket.off(event, handler as never)
      resolve(payload)
    }
    socket.on(event, handler as never)
  })
}

async function join(socket: ClientSocket, slug: string) {
  const state = next(socket, SERVER_EVENTS.state)
  socket.emit(CLIENT_EVENTS.join, { slug })
  return state
}

test.group('Realtime (Socket.io)', (group) => {
  group.each.setup(() => resetState())
  group.each.teardown(() => {
    for (const socket of sockets.splice(0)) socket.disconnect()
  })

  test('joining a poll room returns a full snapshot', async ({ client: http, assert }) => {
    const { session } = await registerUser(http)
    const poll = await createPoll(http, session)

    const a = await client()
    const { poll: snapshot } = await join(a, poll.slug)
    assert.equal(snapshot.slug, poll.slug)
    assert.lengthOf(snapshot.options, 3)
    assert.notProperty(snapshot, 'ownerId')
  })

  test('A votes over REST and B receives poll:updated with the new counts', async ({
    client: http,
    assert,
  }) => {
    const { session } = await registerUser(http)
    const poll = await createPoll(http, session)
    const a = await client()
    const b = await client()
    await join(a, poll.slug)
    await join(b, poll.slug)

    const update = next(b, SERVER_EVENTS.updated, (p) => p.totalVotes === 1)
    const response = await vote(http, poll.slug, poll.options[1]!.id, newVoterId())
    response.assertStatus(200)

    const payload = await update
    assert.equal(payload.slug, poll.slug)
    assert.deepEqual(
      payload.options.map((o) => o.votes),
      [0, 1, 0]
    )
  })

  test('a burst of votes ends with a broadcast of the final counts', async ({
    client: http,
    assert,
  }) => {
    const { session } = await registerUser(http)
    const poll = await createPoll(http, session)
    const b = await client()
    await join(b, poll.slug)

    const final = next(b, SERVER_EVENTS.updated, (p) => p.totalVotes === 30)
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        vote(http, poll.slug, poll.options[i % 3]!.id, newVoterId())
      )
    )
    const payload = await final
    assert.deepEqual(
      payload.options.map((o) => o.votes),
      [10, 10, 10]
    )
  })

  test('closing a poll emits poll:closed to everyone in the room', async ({
    client: http,
    assert,
  }) => {
    const { session } = await registerUser(http)
    const poll = await createPoll(http, session)
    const a = await client()
    const b = await client()
    await join(a, poll.slug)
    await join(b, poll.slug)

    const closedA = next(a, SERVER_EVENTS.closed)
    const closedB = next(b, SERVER_EVENTS.closed)
    await http.post(`/api/polls/${poll.slug}/close`).withCookie('lp_session', session)

    assert.deepEqual(await closedA, { slug: poll.slug })
    assert.deepEqual(await closedB, { slug: poll.slug })
  })

  test('presence counts sockets in the room on join, leave and disconnect', async ({
    client: http,
    assert,
  }) => {
    const { session } = await registerUser(http)
    const poll = await createPoll(http, session)
    const a = await client()
    const b = await client()

    const firstJoin = next(a, SERVER_EVENTS.presence)
    await join(a, poll.slug)
    assert.deepEqual(await firstJoin, { slug: poll.slug, count: 1 })

    const secondJoin = next(a, SERVER_EVENTS.presence, (p) => p.count === 2)
    await join(b, poll.slug)
    assert.deepEqual(await secondJoin, { slug: poll.slug, count: 2 })

    const afterLeave = next(a, SERVER_EVENTS.presence, (p) => p.count === 1)
    b.emit(CLIENT_EVENTS.leave, { slug: poll.slug })
    assert.deepEqual(await afterLeave, { slug: poll.slug, count: 1 })

    // B comes back, then drops its connection entirely.
    const backTo2 = next(a, SERVER_EVENTS.presence, (p) => p.count === 2)
    await join(b, poll.slug)
    await backTo2
    const afterDisconnect = next(a, SERVER_EVENTS.presence, (p) => p.count === 1)
    b.disconnect()
    assert.deepEqual(await afterDisconnect, { slug: poll.slug, count: 1 })
  })

  test('a socket watches one poll at a time: joining another room leaves the first', async ({
    client: http,
    assert,
  }) => {
    const { session } = await registerUser(http)
    const first = await createPoll(http, session)
    const second = await createPoll(http, session)
    const watcher = await client()
    const roaming = await client()
    await join(watcher, first.slug)

    const joined = next(watcher, SERVER_EVENTS.presence, (p) => p.count === 2)
    await join(roaming, first.slug)
    await joined

    const left = next(watcher, SERVER_EVENTS.presence, (p) => p.count === 1)
    await join(roaming, second.slug)
    assert.deepEqual(await left, { slug: first.slug, count: 1 })
  })

  test('a reconnecting client can re-join and gets fresh state', async ({
    client: http,
    assert,
  }) => {
    const { session } = await registerUser(http)
    const poll = await createPoll(http, session)
    const a = await client()
    await join(a, poll.slug)
    a.disconnect()

    // A vote lands while A is offline.
    await vote(http, poll.slug, poll.options[0]!.id, newVoterId())

    a.connect()
    await new Promise<void>((resolve) => a.once('connect', () => resolve()))
    const { poll: snapshot } = await join(a, poll.slug)
    assert.equal(snapshot.totalVotes, 1)
  })

  test('invalid or unknown slugs are ignored', async ({ client: http, assert }) => {
    const { session } = await registerUser(http)
    await createPoll(http, session)
    const a = await client()

    let received = false
    a.on(SERVER_EVENTS.state, () => (received = true))
    a.emit(CLIENT_EVENTS.join, { slug: 'not valid!' })
    a.emit(CLIENT_EVENTS.join, { slug: 'zzzzzzzz' })
    a.emit(CLIENT_EVENTS.join, 'garbage' as never)
    await new Promise((resolve) => setTimeout(resolve, 200))
    assert.isFalse(received)
    assert.isTrue(a.connected)
  })

  test('sockets cannot write: there is no vote event', async ({ client: http, assert }) => {
    const { session } = await registerUser(http)
    const poll = await createPoll(http, session)
    const a = await client()
    await join(a, poll.slug)
    ;(a as unknown as Socket).emit('poll:vote', { slug: poll.slug, optionId: poll.options[0]!.id })
    await new Promise((resolve) => setTimeout(resolve, 200))

    const response = await http.get(`/api/polls/${poll.slug}`)
    assert.equal(response.body().poll.totalVotes, 0)
  })
})
