import { Navigate, Outlet } from 'react-router'
import { useAppSelector } from '../store/hooks'

/** Guards nested routes. Waits for the initial /auth/me before deciding. */
export function RequireAuth() {
  const status = useAppSelector((state) => state.auth.status)
  if (status === 'unknown') {
    return (
      <p role="status" className="text-slate-700">
        Checking your session…
      </p>
    )
  }
  if (status === 'anonymous') return <Navigate to="/" replace />
  return <Outlet />
}
