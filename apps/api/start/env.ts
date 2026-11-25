/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| Validates environment variables at boot and casts them to JS types.
| The app refuses to start if a required variable is missing.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  MONGO_URL: Env.schema.string(),
  CORS_ORIGINS: Env.schema.string(),
  RATE_LIMIT_AUTH_PER_MIN: Env.schema.number(),
  RATE_LIMIT_VOTE_PER_MIN: Env.schema.number(),
  /** Set to true only when the API sits behind a reverse proxy (nginx in Docker). */
  TRUST_PROXY: Env.schema.boolean.optional(),
  /** Defaults to true in production. */
  COOKIE_SECURE: Env.schema.boolean.optional(),
})
