import { useState, type FormEvent } from 'react'
import type { PollDTO } from '@livepoll/shared'
import { useVoteMutation } from '../store/api'
import { parseApiError } from '../lib/apiError'
import { FormError } from './FormError'
import { focusRing, primaryButton } from './ui'

interface VoteFormProps {
  poll: PollDTO
  myVote: string | null
}

/** Native radio group: Tab into it, arrows to choose, Tab to the button, Enter to vote. */
export function VoteForm({ poll, myVote }: VoteFormProps) {
  const [selected, setSelected] = useState<string | null>(myVote)
  const [vote, { isLoading, error }] = useVoteMutation()
  const isChange = myVote !== null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (selected) void vote({ slug: poll.slug, optionId: selected })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-slate-800">
          {isChange ? 'Change your vote' : 'Pick one option'}
        </legend>
        {poll.options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-900 hover:border-indigo-400 has-checked:border-indigo-600 has-checked:bg-indigo-50"
          >
            <input
              type="radio"
              name="option"
              value={option.id}
              checked={selected === option.id}
              onChange={() => setSelected(option.id)}
              className={`size-4 accent-indigo-600 ${focusRing}`}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {error && <FormError message={parseApiError(error).message} />}
      <button
        type="submit"
        className={primaryButton}
        disabled={!selected || selected === myVote || isLoading}
      >
        {isChange ? 'Change vote' : 'Vote'}
      </button>
    </form>
  )
}
