import { makePoll } from '../test/http'
import {
  pollClosed,
  pollSlice,
  presenceChanged,
  resultsUpdated,
  stateReceived,
  unwatchPoll,
  watchPoll,
  type PollState,
} from './pollSlice'

const reducer = pollSlice.reducer

function watching(slug = 'abcd1234'): PollState {
  const state = reducer(undefined, watchPoll(slug))
  return reducer(state, stateReceived({ poll: makePoll({ slug }) }))
}

describe('poll slice', () => {
  it('watchPoll starts from a clean state for a new slug', () => {
    const state = reducer(watching('abcd1234'), watchPoll('zzzz9999'))
    expect(state).toMatchObject({ slug: 'zzzz9999', poll: null, myVote: null, viewers: 0 })
  })

  it('ignores a poll:state for another slug', () => {
    const state = reducer(undefined, watchPoll('abcd1234'))
    expect(reducer(state, stateReceived({ poll: makePoll({ slug: 'other123' }) })).poll).toBeNull()
  })

  it('applies poll:updated counts when the slug matches', () => {
    const state = reducer(
      watching(),
      resultsUpdated({
        slug: 'abcd1234',
        options: [
          { id: 'a', votes: 4 },
          { id: 'b', votes: 6 },
        ],
        totalVotes: 10,
      })
    )
    expect(state.poll?.options.map((option) => option.votes)).toEqual([4, 6])
    expect(state.poll?.totalVotes).toBe(10)
  })

  it('ignores poll:updated for another slug', () => {
    const before = watching()
    const after = reducer(
      before,
      resultsUpdated({ slug: 'other123', options: [{ id: 'a', votes: 99 }], totalVotes: 99 })
    )
    expect(after).toEqual(before)
  })

  it('poll:closed switches the status to closed', () => {
    expect(reducer(watching(), pollClosed({ slug: 'abcd1234' })).poll?.status).toBe('closed')
    expect(reducer(watching(), pollClosed({ slug: 'other123' })).poll?.status).toBe('open')
  })

  it('poll:presence sets the viewer count for the watched poll only', () => {
    expect(reducer(watching(), presenceChanged({ slug: 'abcd1234', count: 3 })).viewers).toBe(3)
    expect(reducer(watching(), presenceChanged({ slug: 'other123', count: 3 })).viewers).toBe(0)
  })

  it('unwatchPoll clears the poll but keeps the connection status', () => {
    const connected = { ...watching(), connection: 'connected' as const }
    const state = reducer(connected, unwatchPoll('abcd1234'))
    expect(state).toMatchObject({ slug: null, poll: null, connection: 'connected' })
  })
})

describe('poll slice: closed is final', () => {
  it('a late REST response read before the close does not re-open the poll', async () => {
    const { api } = await import('./api')
    const { makePoll } = await import('../test/http')
    const { pollSlice, watchPoll, stateReceived, pollClosed } = await import('./pollSlice')
    const reducer = pollSlice.reducer
    const open = makePoll({ slug: 'abcd1234', status: 'open' })
    const optionId = open.options[0]?.id

    let state = reducer(undefined, watchPoll('abcd1234'))
    state = reducer(state, stateReceived({ poll: open }))
    state = reducer(state, pollClosed({ slug: 'abcd1234' }))
    expect(state.poll?.status).toBe('closed')

    // The vote response was computed while the poll was still open.
    const late = {
      type: `${api.reducerPath}/executeMutation/fulfilled`,
      payload: { poll: open, myVote: optionId },
      meta: { arg: { endpointName: 'vote', type: 'mutation' }, requestStatus: 'fulfilled' },
    }
    state = reducer(state, late as never)
    expect(state.poll?.status).toBe('closed')
    expect(state.myVote).toBe(optionId)

    state = reducer(state, stateReceived({ poll: open }))
    expect(state.poll?.status).toBe('closed')
  })
})

describe('poll slice: REST vs socket ordering', () => {
  async function load() {
    const { api } = await import('./api')
    const { makePoll } = await import('../test/http')
    const slice = await import('./pollSlice')
    const poll = makePoll({ slug: 'abcd1234', allowVoteChange: true })
    const a = poll.options[0]?.id ?? ''
    const b = poll.options[1]?.id ?? ''
    const action = (endpointName: string, phase: string, requestId: string, payload?: unknown) => ({
      type: `${api.reducerPath}/${endpointName === 'vote' ? 'executeMutation' : 'executeQuery'}/${phase}`,
      payload,
      meta: {
        requestId,
        requestStatus: phase,
        arg: {
          endpointName,
          type: endpointName === 'vote' ? 'mutation' : 'query',
          originalArgs: 'abcd1234',
        },
      },
    })
    return { ...slice, poll, a, b, action }
  }

  it('does not allow voting until the voter-specific GET has answered', async () => {
    const { pollSlice, watchPoll, stateReceived, poll, action } = await load()
    let state = pollSlice.reducer(undefined, watchPoll('abcd1234'))
    // The socket snapshot can arrive first: results are shown, but myVote is unknown.
    state = pollSlice.reducer(state, stateReceived({ poll }))
    expect(state.poll).not.toBeNull()
    expect(state.myVoteKnown).toBe(false)

    state = pollSlice.reducer(state, action('getPoll', 'pending', 'r1') as never)
    state = pollSlice.reducer(
      state,
      action('getPoll', 'fulfilled', 'r1', { poll, myVote: null }) as never
    )
    expect(state.myVoteKnown).toBe(true)
  })

  it('a GET that started before a vote change cannot restore the old choice', async () => {
    const { pollSlice, watchPoll, poll, a, b, action } = await load()
    let state = pollSlice.reducer(undefined, watchPoll('abcd1234'))
    state = pollSlice.reducer(state, action('getPoll', 'pending', 'reconnect') as never)
    // The voter changes A → B while the reconnect read is in flight...
    state = pollSlice.reducer(
      state,
      action('vote', 'fulfilled', 'v1', { poll, myVote: b }) as never
    )
    // ...and the read, computed before the change, arrives last.
    state = pollSlice.reducer(
      state,
      action('getPoll', 'fulfilled', 'reconnect', { poll, myVote: a }) as never
    )
    expect(state.myVote).toBe(b)
  })
})
