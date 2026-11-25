import { Link } from 'react-router'
import { AuthForm } from '../components/AuthForm'
import { useAppSelector } from '../store/hooks'
import { primaryButton } from '../components/ui'

export function LandingPage() {
  const { user, status } = useAppSelector((state) => state.auth)

  return (
    <div className="grid gap-8 md:grid-cols-2 md:items-start">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Ask a question. Watch the answers arrive.
        </h1>
        <p className="text-slate-700">
          Create a poll in seconds, share the link, and see results update live for everyone
          watching. No sign-up needed to vote.
        </p>
      </div>
      {status === 'authenticated' && user ? (
        <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-slate-800">
            Signed in as <strong>{user.email}</strong>.
          </p>
          <Link to="/dashboard" className={primaryButton}>
            Go to your dashboard
          </Link>
        </div>
      ) : (
        <AuthForm />
      )}
    </div>
  )
}
