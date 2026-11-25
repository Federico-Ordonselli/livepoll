import { SERVER_EVENTS, type PollDTO } from '@livepoll/shared'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { jsonResponse, makePoll, mockFetch } from '../test/http'
import { renderWithStore } from '../test/renderWithStore'
import { PollPage } from './PollPage'

const slug = 'abcd1234'

function renderPollPage(poll: PollDTO | null, myVote: string | null = null) {
  const fetchMock = mockFetch({
    [`GET /api/polls/${slug}`]: () =>
      poll
        ? jsonResponse(200, { poll, myVote })
        : jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Poll not found' } }),
    [`POST /api/polls/${slug}/vote`]: async (request) => {
      const { optionId } = (await request.json()) as { optionId: string }
      const options = makePoll().options.map((option) =>
        option.id === optionId ? { ...option, votes: option.votes + 1 } : option
      )
      return jsonResponse(200, { poll: makePoll({ options, totalVotes: 6 }), myVote: optionId })
    },
  })
  const view = renderWithStore(
    <Routes>
      <Route path="/p/:slug" element={<PollPage />} />
    </Routes>,
    { route: `/p/${slug}` }
  )
  return { ...view, fetchMock }
}

describe('PollPage', () => {
  it('shows a loading state, then the question and options', async () => {
    renderPollPage(makePoll())
    expect(screen.getByRole('status')).toHaveTextContent('Loading poll')
    expect(await screen.findByRole('heading', { name: 'Tabs or spaces?' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Tabs' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Spaces' })).toBeInTheDocument()
  })

  it('votes using only the keyboard', async () => {
    const { user, fetchMock } = renderPollPage(makePoll())
    await screen.findByRole('radio', { name: 'Tabs' })

    await user.tab() // focus the radio group
    await user.keyboard('{ArrowDown}') // select "Spaces"
    expect(screen.getByRole('radio', { name: 'Spaces' })).toBeChecked()
    await user.tab() // focus the Vote button
    expect(screen.getByRole('button', { name: 'Vote' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(await screen.findByText(/You voted for/)).toHaveTextContent('You voted for Spaces.')
    const voteRequest = fetchMock.mock.calls
      .map(([request]) => request)
      .find((request) => request.method === 'POST')
    expect(voteRequest?.url).toMatch(`/api/polls/${slug}/vote`)
    expect(
      screen.getByRole('img', { name: 'Spaces: 3 votes, 50% (your vote)' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('shows the already-voted state without vote controls', async () => {
    renderPollPage(makePoll(), 'a')
    expect(await screen.findByText(/You voted for/)).toHaveTextContent(
      'You voted for Tabs. Votes cannot be changed in this poll.'
    )
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Tabs: 3 votes, 60% (your vote)' })).toBeInTheDocument()
  })

  it('lets the voter change their vote when the poll allows it', async () => {
    renderPollPage(makePoll({ allowVoteChange: true }), 'a')
    expect(await screen.findByRole('radio', { name: 'Tabs' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Change vote' })).toBeDisabled()
  })

  it('renders a closed poll read-only', async () => {
    renderPollPage(makePoll({ status: 'closed' }))
    expect(await screen.findByText('This poll is closed. Voting has ended.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vote' })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Tabs: 3 votes, 60%' })).toBeInTheDocument()
  })

  it('shows not found for an unknown poll', async () => {
    renderPollPage(null)
    expect(await screen.findByRole('heading', { name: 'Poll not found' })).toBeInTheDocument()
  })

  it('updates live from the socket and flags a lost connection', async () => {
    const { socket } = renderPollPage(makePoll())
    await screen.findByRole('heading', { name: 'Tabs or spaces?' })

    socket.simulateConnect()
    socket.serverEmit(SERVER_EVENTS.presence, { slug, count: 3 })
    socket.serverEmit(SERVER_EVENTS.updated, {
      slug,
      options: [
        { id: 'a', votes: 3 },
        { id: 'b', votes: 7 },
      ],
      totalVotes: 10,
    })
    expect(await screen.findByText('3 people viewing')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Spaces: 7 votes, 70%' })).toBeInTheDocument()

    socket.simulateDisconnect()
    expect(await screen.findByText(/Connection lost/)).toBeInTheDocument()
  })
})
