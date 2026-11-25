import { Link } from 'react-router'
import { link } from '../components/ui'

export function NotFoundPage({ title = 'Page not found' }: { title?: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="text-slate-700">The link may be mistyped, or the page no longer exists.</p>
      <Link to="/" className={link}>
        Back to the home page
      </Link>
    </div>
  )
}
