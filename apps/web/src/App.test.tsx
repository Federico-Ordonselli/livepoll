import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { routes } from './router'
import { makeStore } from './store'
import { FakeSocket } from './test/fakeSocket'
import { jsonResponse, makePoll, mockFetch } from './test/http'

const user = { id: 'u1', email: 'ada@example.com', createdAt: '2026-01-01T00:00:00.000Z' }

function renderApp(path: string) {
  const socket = new FakeSocket()
  const store = makeStore(undefined, { createSocket: () => socket.asSocket() })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  )
  return { router, user: userEvent.setup() }
}

describe('App', () => {
  it('logs in from the landing page and lists own polls on the dashboard', async () => {
    let closed = false
    mockFetch({
      'GET /api/auth/me': () =>
        jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Not logged in' } }),
      'POST /api/auth/login': () => jsonResponse(200, { user }),
      'GET /api/polls/mine': () =>
        jsonResponse(200, { polls: [makePoll({ status: closed ? 'closed' : 'open' })] }),
      'POST /api/polls/abcd1234/close': () => {
        closed = true
        return jsonResponse(200, { poll: makePoll({ status: 'closed' }) })
      },
    })
    const { user: actor } = renderApp('/')

    await actor.type(await screen.findByLabelText('Email'), 'ada@example.com')
    await actor.type(screen.getByLabelText('Password'), 'longenough')
    await actor.click(screen.getByRole('button', { name: 'Log in' }))

    const row = (await screen.findByRole('heading', { name: 'Tabs or spaces?' })).closest('li')
    if (!row) throw new Error('poll row not found')
    expect(within(row).getByText('5 votes')).toBeInTheDocument()

    await actor.click(within(row).getByRole('button', { name: 'Copy link' }))
    // user-event installs an in-memory clipboard.
    expect(await navigator.clipboard.readText()).toBe(`${location.origin}/p/abcd1234`)
    expect(within(row).getByRole('status')).toHaveTextContent('Copied')

    await actor.click(within(row).getByRole('button', { name: 'Close poll' }))
    expect(await within(row).findByText('Closed')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Close poll' })).not.toBeInTheDocument()
  })

  it('redirects anonymous visitors away from the dashboard', async () => {
    mockFetch({
      'GET /api/auth/me': () =>
        jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Not logged in' } }),
    })
    const { router } = renderApp('/dashboard')
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows a 404 page for unknown routes', async () => {
    mockFetch({ 'GET /api/auth/me': () => jsonResponse(200, { user }) })
    renderApp('/nope')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
