/*
|--------------------------------------------------------------------------
| HTTP rate limiters
|--------------------------------------------------------------------------
|
| Limits are read from env on every request, so tests can lower them.
| Keys are per client IP (see TRUST_PROXY in config/app.ts for Docker).
|
*/

import env from '#start/env'
import limiter from '@adonisjs/limiter/services/main'

export const throttleAuth = limiter.define('auth', (ctx) => {
  return limiter
    .allowRequests(env.get('RATE_LIMIT_AUTH_PER_MIN'))
    .every('1 minute')
    .usingKey(`auth_${ctx.request.ip()}`)
})

export const throttleVote = limiter.define('vote', (ctx) => {
  return limiter
    .allowRequests(env.get('RATE_LIMIT_VOTE_PER_MIN'))
    .every('1 minute')
    .usingKey(`vote_${ctx.request.ip()}`)
})
