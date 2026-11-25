import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import testUtils from '@adonisjs/core/services/test_utils'
import server from '@adonisjs/core/services/server'
import type { Server as HttpServer } from 'node:http'

/**
 * Tests run against a real MongoDB (MONGO_URL in .env.test, started with
 * `pnpm db:up` locally or as a service container in CI).
 */
export const plugins: Config['plugins'] = [assert(), apiClient(), pluginAdonisJS(app)]

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
}

export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['functional'].includes(suite.name)) {
    return suite.setup(async () => {
      const closeHttpServer = await testUtils.httpServer().start()

      // In production the socket provider attaches Socket.io on `ready`;
      // here the HTTP server only exists now.
      const { default: realtime } = await import('#services/realtime')
      const { allowedOrigins } = await import('#config/origins')
      realtime.attach(server.getNodeServer() as HttpServer, allowedOrigins)

      return async () => {
        await realtime.close()
        await closeHttpServer()
      }
    })
  }
}
