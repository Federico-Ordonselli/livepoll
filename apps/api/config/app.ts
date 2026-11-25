import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { Secret } from '@adonisjs/core/helpers'
import { defineConfig } from '@adonisjs/core/http'

/**
 * The app key signs cookies (session + voter id). Rotating it logs everyone
 * out and gives every voter a new identity.
 */
export const appKey = new Secret(env.get('APP_KEY'))

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
  trustProxy: () => trustProxy,

  cookie: {
    domain: '',
    path: '/',
    maxAge: '2h',
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
  },
})
