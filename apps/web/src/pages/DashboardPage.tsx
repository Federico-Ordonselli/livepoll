import { Link } from 'react-router'
import type { PollDTO } from '@livepoll/shared'
import { CopyLinkButton } from '../components/CopyLinkButton'
import { FormError } from '../components/FormError'
import { StatusBadge } from '../components/StatusBadge'
import { link, primaryButton, secondaryButton } from '../components/ui'
import { parseApiError } from '../lib/apiError'
import { useClosePollMutation, useMyPollsQuery } from '../store/api'

function PollRow({ poll }: { poll: PollDTO }) {
  const [closePoll, { isLoading, error }] = useClosePollMutation()
  return (
    <li className="space-y-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-semibold text-slate-900">{poll.question}</h2>
        <StatusBadge status={poll.status} />
      </div>
      <p className="text-sm text-slate-700">
        {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/p/${poll.slug}`} className={link}>
          View poll<span className="sr-only">: {poll.question}</span>
        </Link>
        <CopyLinkButton slug={poll.slug} />
        {poll.status === 'open' && (
          <button
            type="button"
            className={secondaryButton}
            onClick={() => void closePoll(poll.slug)}
            disabled={isLoading}
          >
            Close poll
          </button>
        )}
      </div>
      {error && <FormError message={parseApiError(error).message} />}
    </li>
  )
}

export function DashboardPage() {
  const { data, error, isLoading } = useMyPollsQuery(undefined, { refetchOnMountOrArgChange: true })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Your polls</h1>
        <Link to="/create" className={primaryButton}>
          Create a poll
        </Link>
      </div>
      {isLoading && (
        <p role="status" className="text-slate-700">
          Loading your polls…
        </p>
      )}
      {error && <FormError message={parseApiError(error).message} />}
      {data && data.polls.length === 0 && (
        <p className="text-slate-700">You have no polls yet. Create one and share the link.</p>
      )}
      {data && data.polls.length > 0 && (
        <ul className="space-y-4">
          {data.polls.map((poll) => (
            <PollRow key={poll.id} poll={poll} />
          ))}
        </ul>
      )}
    </div>
  )
}
