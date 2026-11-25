import { Link, Outlet, useNavigate } from 'react-router'
import { useLogoutMutation, useMeQuery } from '../store/api'
import { useAppSelector } from '../store/hooks'
import { link, secondaryButton } from './ui'

export function Layout() {
  useMeQuery() // resolves the session once on app start; the auth slice listens to the result
  const user = useAppSelector((state) => state.auth.user)
  const [logout, { isLoading }] = useLogoutMutation()
  const navigate = useNavigate()

  async function handleLogout() {
    const result = await logout()
    if (!('error' in result)) navigate('/')
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className={`text-lg font-bold text-slate-900 ${link}`}>
            LivePoll
          </Link>
          {user && (
            <nav aria-label="Main" className="flex flex-wrap items-center gap-4 text-sm">
              <Link to="/dashboard" className={link}>
                Dashboard
              </Link>
              <Link to="/create" className={link}>
                New poll
              </Link>
              <button
                type="button"
                className={secondaryButton}
                onClick={handleLogout}
                disabled={isLoading}
              >
                Log out
              </button>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
