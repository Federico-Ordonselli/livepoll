import type { PollStatus } from '@livepoll/shared'

export function StatusBadge({ status }: { status: PollStatus }) {
  const styles =
    status === 'open'
      ? 'bg-emerald-100 text-emerald-900 ring-emerald-300'
      : 'bg-slate-200 text-slate-800 ring-slate-300'
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${styles}`}
    >
      {status === 'open' ? 'Open' : 'Closed'}
    </span>
  )
}
