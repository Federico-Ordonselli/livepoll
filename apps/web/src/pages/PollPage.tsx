import { useEffect } from 'react'
import { useParams } from 'react-router'
import { ResultsBars } from '../components/ResultsBars'
import { StatusBadge } from '../components/StatusBadge'
import { VoteForm } from '../components/VoteForm'
import { secondaryButton } from '../components/ui'
import { parseApiError } from '../lib/apiError'
import { useGetPollQuery } from '../store/api'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { unwatchPoll, watchPoll } from '../store/pollSlice'
import { NotFoundPage } from './NotFoundPage'

export function PollPage() {
  const slug = useParams().slug ?? ''
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(watchPoll(slug))
    return () => {
      dispatch(unwatchPoll(slug))
    }
  }, [dispatch, slug])

  // Always refetch on mount: the poll slice is reset by watchPoll and is filled from this response.
  const { error, refetch } = useGetPollQuery(slug, { refetchOnMountOrArgChange: true })
  const live = useAppSelector((state) => (state.poll.slug === slug ? state.poll : null))
  const poll = live?.poll

  if (!live || !poll) {
    if (error) {
      if (parseApiError(error).status === 404) return <NotFoundPage title="Poll not found" />
      return (
        <div className="space-y-4" role="alert">
          <h1 className="text-2xl font-bold text-slate-900">Could not load this poll</h1>
          <p className="text-slate-700">{parseApiError(error).message}</p>
          <button type="button" className={secondaryButton} onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      )
    }
    return (
      <p role="status" className="text-slate-700">
        Loading poll…
      </p>
    )
  }

  const { myVote, viewers, connection } = live
  const isOpen = poll.status === 'open'
  const canVote = isOpen && (myVote === null || poll.allowVoteChange)
  const myOption = poll.options.find((option) => option.id === myVote)

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={poll.status} />
          {viewers > 0 && (
            <p className="text-sm text-slate-700">
              {viewers} {viewers === 1 ? 'person' : 'people'} viewing
            </p>
          )}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{poll.question}</h1>
      </header>

      {connection === 'disconnected' && (
        <p
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Connection lost. Reconnecting… results may be out of date.
        </p>
      )}

      {!isOpen && (
        <p className="rounded-md border border-slate-300 bg-slate-100 p-3 font-medium text-slate-800">
          This poll is closed. Voting has ended.
        </p>
      )}

      {myOption && (
        <p className="text-slate-800">
          You voted for <strong>{myOption.label}</strong>.
          {isOpen && !poll.allowVoteChange && ' Votes cannot be changed in this poll.'}
        </p>
      )}

      {/* Keyed on myVote so the selection resets when a fresh myVote arrives. */}
      {canVote && <VoteForm key={myVote ?? 'none'} poll={poll} myVote={myVote} />}

      <ResultsBars options={poll.options} totalVotes={poll.totalVotes} myVote={myVote} />
    </article>
  )
}
