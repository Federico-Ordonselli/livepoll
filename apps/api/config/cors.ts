import { defineConfig } from '@adonisjs/cors'
import { allowedOrigins } from '#config/origins'

/**
 * Only the web app's origins may make credentialed cross-origin requests.
 * (In dev and Docker the web app proxies /api, so requests are same-origin anyway.)
 */
const corsConfig = defineConfig({
  enabled: true,
  origin: allowedOrigins,
  methods: ['GET', 'HEAD', 'POST'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
