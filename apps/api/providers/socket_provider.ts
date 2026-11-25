import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Attaches Socket.io to the Node.js HTTP server created by AdonisJS.
 *
 * `ready()` runs after the HTTP server was created and is listening, so
 * `server.getNodeServer()` is available. In tests the HTTP server is started
 * later by `testUtils.httpServer()`, so tests/bootstrap.ts attaches it there.
 */
export default class SocketProvider {
  constructor(protected app: ApplicationService) {}

  async ready() {
    if (this.app.getEnvironment() !== 'web') return
    const server = await this.app.container.make('server')
    const nodeServer = server.getNodeServer()
    if (!nodeServer) return

    const { default: realtime } = await import('#services/realtime')
    const { allowedOrigins } = await import('#config/origins')
    realtime.attach(nodeServer as import('node:http').Server, allowedOrigins)
  }

  async shutdown() {
    const { default: realtime } = await import('#services/realtime')
    await realtime.close()
  }
}
