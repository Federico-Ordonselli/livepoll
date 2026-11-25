import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { LIMITS, credentialsSchema } from '@livepoll/shared'
import { useLoginMutation, useRegisterMutation } from '../store/api'
import { parseApiError } from '../lib/apiError'
import { FormError } from './FormError'
import { TextField } from './TextField'
import { link, primaryButton } from './ui'

type Mode = 'login' | 'register'
type FieldErrors = Partial<Record<'email' | 'password', string>>

const fieldMessages = {
  email: 'Enter a valid email address.',
  password: `Password must be between ${LIMITS.passwordMin} and ${LIMITS.passwordMax} characters.`,
}

export function AuthForm() {
  const [mode, setMode] = useState<Mode>('login')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [login, loginState] = useLoginMutation()
  const [register, registerState] = useRegisterMutation()
  const navigate = useNavigate()
  const isRegister = mode === 'register'
  const isLoading = loginState.isLoading || registerState.isLoading

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = credentialsSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    })
    setFormError(null)
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (field === 'email' || field === 'password') errors[field] = fieldMessages[field]
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    const result = await (isRegister ? register(parsed.data) : login(parsed.data))
    if ('error' in result) {
      const apiError = parseApiError(result.error)
      setFormError(apiError.message)
      setFieldErrors(
        Object.fromEntries(apiError.details.map((detail) => [detail.field, detail.message]))
      )
      return
    }
    navigate('/dashboard')
  }

  function toggleMode() {
    setMode(isRegister ? 'login' : 'register')
    setFieldErrors({})
    setFormError(null)
  }

  return (
    <section
      aria-labelledby="auth-heading"
      className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200"
    >
      <h2 id="auth-heading" className="text-xl font-semibold text-slate-900">
        {isRegister ? 'Create an account' : 'Log in'}
      </h2>
      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <FormError message={formError} />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={fieldErrors.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
          error={fieldErrors.password}
        />
        <button type="submit" className={`${primaryButton} w-full`} disabled={isLoading}>
          {isRegister ? 'Create account' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-700">
        {isRegister ? 'Already have an account?' : 'New here?'}{' '}
        <button type="button" className={link} onClick={toggleMode}>
          {isRegister ? 'Log in instead' : 'Create an account'}
        </button>
      </p>
    </section>
  )
}
