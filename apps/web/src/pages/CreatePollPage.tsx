import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { LIMITS, createPollSchema } from '@livepoll/shared'
import { FormError } from '../components/FormError'
import { TextField } from '../components/TextField'
import { focusRing, primaryButton, secondaryButton, textInput } from '../components/ui'
import { parseApiError } from '../lib/apiError'
import { useCreatePollMutation } from '../store/api'

type Field = 'question' | 'options'
type FieldErrors = Partial<Record<Field, string>>

const fieldMessages: Record<Field, string> = {
  question: `Write a question between ${LIMITS.questionMin} and ${LIMITS.questionMax} characters.`,
  options: `Add between ${LIMITS.optionsMin} and ${LIMITS.optionsMax} options (up to ${LIMITS.optionLabelMax} characters each).`,
}

const isField = (value: unknown): value is Field => value === 'question' || value === 'options'

export function CreatePollPage() {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [allowVoteChange, setAllowVoteChange] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<{ message: string; extra: string[] } | null>(null)
  const [createPoll, { isLoading }] = useCreatePollMutation()
  const navigate = useNavigate()

  function updateOption(index: number, value: string) {
    setOptions(options.map((option, i) => (i === index ? value : option)))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    // Blank inputs are ignored, so leaving a spare empty option is fine.
    const parsed = createPollSchema.safeParse({
      question,
      options: options.map((option) => option.trim()).filter(Boolean),
      allowVoteChange,
    })
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (isField(field)) errors[field] = fieldMessages[field]
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})

    const result = await createPoll(parsed.data)
    if ('data' in result && result.data) {
      navigate(`/p/${result.data.poll.slug}`)
      return
    }
    // Server-side validation: show each detail next to its field, or in the summary.
    const apiError = parseApiError(result.error)
    const errors: FieldErrors = {}
    const extra: string[] = []
    for (const detail of apiError.details) {
      const field = detail.field.split('.')[0]
      if (isField(field)) errors[field] = detail.message
      else extra.push(detail.message)
    }
    setFieldErrors(errors)
    setFormError({ message: apiError.message, extra })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Create a poll</h1>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6 rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200"
      >
        <FormError message={formError?.message ?? null} extra={formError?.extra} />
        <TextField
          label="Question"
          name="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={LIMITS.questionMax}
          error={fieldErrors.question}
        />

        <fieldset
          className="space-y-3"
          aria-describedby={fieldErrors.options ? 'options-error' : undefined}
        >
          <legend className="text-sm font-medium text-slate-800">
            Options ({LIMITS.optionsMin}–{LIMITS.optionsMax})
          </legend>
          {options.map((option, index) => (
            // Index keys are fine: inputs are controlled and carry no other state.
            <div key={index} className="flex items-center gap-2">
              <label htmlFor={`option-${index}`} className="sr-only">
                Option {index + 1}
              </label>
              <input
                id={`option-${index}`}
                className={textInput}
                value={option}
                onChange={(event) => updateOption(index, event.target.value)}
                maxLength={LIMITS.optionLabelMax}
                placeholder={`Option ${index + 1}`}
                aria-invalid={fieldErrors.options ? true : undefined}
              />
              <button
                type="button"
                className={secondaryButton}
                onClick={() => setOptions(options.filter((_, i) => i !== index))}
                disabled={options.length <= LIMITS.optionsMin}
                aria-label={`Remove option ${index + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
          {fieldErrors.options && (
            <p id="options-error" className="text-sm text-red-700">
              {fieldErrors.options}
            </p>
          )}
          <button
            type="button"
            className={secondaryButton}
            onClick={() => setOptions([...options, ''])}
            disabled={options.length >= LIMITS.optionsMax}
          >
            Add option
          </button>
        </fieldset>

        <div className="flex items-center gap-2">
          <input
            id="allow-vote-change"
            type="checkbox"
            checked={allowVoteChange}
            onChange={(event) => setAllowVoteChange(event.target.checked)}
            className={`size-4 accent-indigo-600 ${focusRing}`}
          />
          <label htmlFor="allow-vote-change" className="text-sm text-slate-800">
            Allow voters to change their vote
          </label>
        </div>

        <button type="submit" className={primaryButton} disabled={isLoading}>
          Create poll
        </button>
      </form>
    </div>
  )
}
