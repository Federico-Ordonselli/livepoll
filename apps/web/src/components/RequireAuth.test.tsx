import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import type { AuthState } from '../store/authSlice'
import { renderWithStore } from '../test/renderWithStore'
import { RequireAuth } from './RequireAuth'

function renderGuarded(auth: AuthState) {
  renderWithStore(
    <Routes>
      <Route path="/" element={<h1>Landing</h1>} />
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      </Route>
    </Routes>,
    { route: '/dashboard', preloadedState: { auth } }
  )
}

describe('RequireAuth', () => {
  it('waits while the session is unknown', () => {
    renderGuarded({ user: null, status: 'unknown', pendingCheck: null })
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
  })

  it('redirects anonymous users to the landing page', () => {
    renderGuarded({ user: null, status: 'anonymous', pendingCheck: null })
    expect(screen.getByRole('heading', { name: 'Landing' })).toBeInTheDocument()
  })

  it('renders the page for authenticated users', () => {
    renderGuarded({
      user: { id: 'u1', email: 'ada@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
      status: 'authenticated',
      pendingCheck: null,
    })
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })
})
