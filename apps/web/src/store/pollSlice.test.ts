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
