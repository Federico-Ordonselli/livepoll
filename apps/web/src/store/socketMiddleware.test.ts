import { CLIENT_EVENTS, SERVER_EVENTS } from '@livepoll/shared'
import { waitFor } from '@testing-library/react'
import { FakeSocket } from '../test/fakeSocket'
import { jsonResponse, makePoll, mockFetch } from '../test/http'
import { makeStore } from './index'
import { stateReceived, unwatchPoll, watchPoll } from './pollSlice'

const slug = 'abcd1234'

function setup() {
  const socket = new FakeSocket()
  const createSocket = vi.fn(() => socket.asSocket())
  const store = makeStore(undefined, { createSocket })
  return { socket, createSocket, store }
}

describe('socket middleware', () => {
  it('creates and connects the socket lazily, on the first watchPoll', () => {
    const { socket, createSocket, store } = setup()
    expect(createSocket).not.toHaveBeenCalled()

    store.dispatch(watchPoll(slug))
    expect(createSocket).toHaveBeenCalledTimes(1)
    expect(socket.connectCalls).toBe(1)
    expect(store.getState().poll.connection).toBe('connecting')
  })

  it('joins the room with the slug once connected', () => {
    const { socket, store } = setup()
    store.dispatch(watchPoll(slug))
    expect(socket.emitted).toEqual([])

    socket.simulateConnect()
    expect(socket.emitted).toEqual([{ event: CLIENT_EVENTS.join, payload: { slug } }])
    expect(store.getState().poll.connection).toBe('connected')
  })

  it('dispatches results on poll:updated', () => {
    const { socket, store } = setup()
    store.dispatch(watchPoll(slug))
    socket.simulateConnect()
    socket.serverEmit(SERVER_EVENTS.state, { poll: makePoll() })

    socket.serverEmit(SERVER_EVENTS.updated, {
      slug,
      options: [
        { id: 'a', votes: 10 },
        { id: 'b', votes: 0 },
      ],
      totalVotes: 10,
    })
    expect(store.getState().poll.poll?.totalVotes).toBe(10)
    expect(store.getState().poll.poll?.options[0]?.votes).toBe(10)
  })

  it('forwards poll:closed and poll:presence', () => {
    const { socket, store } = setup()
    store.dispatch(watchPoll(slug))
    socket.simulateConnect()
    store.dispatch(stateReceived({ poll: makePoll() }))

    socket.serverEmit(SERVER_EVENTS.presence, { slug, count: 4 })
    socket.serverEmit(SERVER_EVENTS.closed, { slug })
    expect(store.getState().poll.viewers).toBe(4)
    expect(store.getState().poll.poll?.status).toBe('closed')
  })

  it('on reconnect re-joins the room and refetches the poll', async () => {
    const fetchMock = mockFetch({
      [`GET /api/polls/${slug}`]: () =>
        jsonResponse(200, { poll: makePoll({ totalVotes: 42 }), myVote: 'b' }),
    })
    const { socket, store } = setup()
    store.dispatch(watchPoll(slug))
    socket.simulateConnect()

    socket.simulateDisconnect()
    expect(store.getState().poll.connection).toBe('disconnected')

    socket.emitted = []
    socket.simulateConnect()
    expect(socket.emitted).toEqual([{ event: CLIENT_EVENTS.join, payload: { slug } }])
    await waitFor(() => expect(store.getState().poll.myVote).toBe('b'))
    expect(store.getState().poll.poll?.totalVotes).toBe(42)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('leaves the room on unwatchPoll', () => {
    const { socket, store } = setup()
    store.dispatch(watchPoll(slug))
    socket.simulateConnect()

    store.dispatch(unwatchPoll(slug))
    expect(socket.emitted.at(-1)).toEqual({ event: CLIENT_EVENTS.leave, payload: { slug } })
  })

  it('reuses the connected socket when watching another poll', () => {
    const { socket, createSocket, store } = setup()
    store.dispatch(watchPoll(slug))
    socket.simulateConnect()
    store.dispatch(unwatchPoll(slug))
    store.dispatch(watchPoll('other123'))

    expect(createSocket).toHaveBeenCalledTimes(1)
    expect(socket.emitted.at(-1)).toEqual({
      event: CLIENT_EVENTS.join,
      payload: { slug: 'other123' },
    })
  })
})

describe('socket middleware: server-initiated disconnects', () => {
  it('reconnects by itself after "io server disconnect" (e.g. API restart)', () => {
    const { socket, store } = setup()
    store.dispatch(watchPoll(slug))
    socket.simulateConnect()
    expect(socket.connectCalls).toBe(1)

    socket.simulateDisconnect('io server disconnect')
    expect(store.getState().poll.connection).toBe('disconnected')
    expect(socket.connectCalls).toBe(2)
  })

  it('does not hide an outage behind "connecting" when switching polls while retrying', () => {
    const { socket, store } = setup()
    store.dispatch(watchPoll(slug))
    socket.simulateConnect()
    socket.simulateDisconnect('transport close')

    store.dispatch(watchPoll('efgh5678'))
    expect(store.getState().poll.connection).toBe('disconnected')
    expect(socket.connectCalls).toBe(1) // socket.io is already retrying
  })
})
