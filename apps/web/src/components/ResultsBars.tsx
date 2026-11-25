import { withPercentages, type PollOptionDTO } from '@livepoll/shared'

interface ResultsBarsProps {
  options: PollOptionDTO[]
  totalVotes: number
  myVote: string | null
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export function ResultsBars({ options, totalVotes, myVote }: ResultsBarsProps) {
  return (
    <section aria-labelledby="results-heading" aria-live="polite" className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 id="results-heading" className="text-lg font-semibold text-slate-900">
          Results
        </h2>
        <p className="text-sm text-slate-700">{plural(totalVotes, 'vote')} total</p>
      </div>
      <ul className="space-y-3">
        {withPercentages(options, totalVotes).map((option) => {
          const isMine = option.id === myVote
          const summary = `${option.label}: ${plural(option.votes, 'vote')}, ${option.percent}%${isMine ? ' (your vote)' : ''}`
          return (
            <li key={option.id}>
              {/* Visual row; screen readers get the same info once, from the bar's label. */}
              <div aria-hidden="true" className="mb-1 flex justify-between gap-2 text-sm">
                <span className={isMine ? 'font-semibold text-indigo-800' : 'text-slate-800'}>
                  {option.label}
                  {isMine && ' · your vote'}
                </span>
                <span className="text-slate-700 tabular-nums">
                  {plural(option.votes, 'vote')} · {option.percent}%
                </span>
              </div>
              <div
                role="img"
                aria-label={summary}
                className="h-3 overflow-hidden rounded-full bg-slate-200"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${isMine ? 'bg-indigo-700' : 'bg-indigo-500'}`}
                  style={{ width: `${option.percent}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
