import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { Secret } from '@adonisjs/core/helpers'
import { defineConfig } from '@adonisjs/core/http'

/**
 * The app key signs cookies (session + voter id). Rotating it logs everyone
 * out and gives every voter a new identity.
 */
const rawAppKey = env.get('APP_KEY')
const PUBLIC_KEYS = ['test-key-not-a-secret-0123456789abc']
if (rawAppKey.length < 32 || (app.inProduction && PUBLIC_KEYS.includes(rawAppKey))) {
  throw new Error('APP_KEY must be a random secret of at least 32 characters')
}
export const appKey = new Secret(rawAppKey)

const trustProxy = env.get('TRUST_PROXY', false)

export const cookieSecure = env.get('COOKIE_SECURE', app.inProduction)

export const http = defineConfig({
  generateRequestId: true,
  allowMethodSpoofing: false,
  useAsyncLocalStorage: false,

  /**
   * Behind nginx every request comes from the proxy's IP; trusting it makes
   * `request.ip()` read X-Forwarded-For so rate limits stay per client.
   */
  // Only the immediate peer (nginx) is trusted, so a client-supplied
  // X-Forwarded-For entry can never become the rate-limit key.
  trustProxy: (_address: string, distance: number) => trustProxy && distance === 0,

  cookie: {
    domain: '',
    path: '/',
    maxAge: '2h',
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
  },
})
