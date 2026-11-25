import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { jsonResponse, makePoll, mockFetch } from '../test/http'
import { renderWithStore } from '../test/renderWithStore'
import { CreatePollPage } from './CreatePollPage'

function renderCreatePage(createResponse = () => jsonResponse(201, { poll: makePoll() })) {
  const fetchMock = mockFetch({ 'POST /api/polls': createResponse })
  const view = renderWithStore(
    <Routes>
      <Route path="/create" element={<CreatePollPage />} />
      <Route path="/p/:slug" element={<h1>Poll page</h1>} />
    </Routes>,
    { route: '/create' }
  )
  return { ...view, fetchMock }
}

describe('CreatePollPage', () => {
  it('blocks a short question and fewer than two options', async () => {
    const { user, fetchMock } = renderCreatePage()
    await user.type(screen.getByLabelText('Question'), 'Hi')
    await user.type(screen.getByLabelText('Option 1'), 'Only one')
    await user.click(screen.getByRole('button', { name: 'Create poll' }))

    expect(screen.getByLabelText('Question')).toHaveAccessibleDescription(/between 3 and 200/)
    expect(screen.getByRole('group', { name: /Options/ })).toHaveAccessibleDescription(
      /between 2 and 8 options/
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('adds options up to 8 and never removes below 2', async () => {
    const { user } = renderCreatePage()
    expect(screen.getByRole('button', { name: 'Remove option 1' })).toBeDisabled()

    const add = screen.getByRole('button', { name: 'Add option' })
    for (let i = 0; i < 6; i++) await user.click(add)
    expect(screen.getByLabelText('Option 8')).toBeInTheDocument()
    expect(add).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Remove option 8' }))
    expect(screen.queryByLabelText('Option 8')).not.toBeInTheDocument()
  })

  it('submits a valid poll and navigates to it', async () => {
    const { user, fetchMock } = renderCreatePage()
    await user.type(screen.getByLabelText('Question'), '  Tabs or spaces?  ')
    await user.type(screen.getByLabelText('Option 1'), 'Tabs')
    await user.type(screen.getByLabelText('Option 2'), 'Spaces')
    await user.click(screen.getByLabelText('Allow voters to change their vote'))
    await user.click(screen.getByRole('button', { name: 'Create poll' }))

    expect(await screen.findByRole('heading', { name: 'Poll page' })).toBeInTheDocument()
    const request = fetchMock.mock.calls[0]?.[0]
    expect(await request?.json()).toEqual({
      question: 'Tabs or spaces?',
      options: ['Tabs', 'Spaces'],
      allowVoteChange: true,
    })
  })

  it('shows server validation details next to the field', async () => {
    const { user } = renderCreatePage(() =>
      jsonResponse(422, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: [{ field: 'question', message: 'Question is not allowed' }],
        },
      })
    )
    await user.type(screen.getByLabelText('Question'), 'Tabs or spaces?')
    await user.type(screen.getByLabelText('Option 1'), 'Tabs')
    await user.type(screen.getByLabelText('Option 2'), 'Spaces')
    await user.click(screen.getByRole('button', { name: 'Create poll' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Validation failed')
    expect(screen.getByLabelText('Question')).toHaveAccessibleDescription('Question is not allowed')
  })
})
