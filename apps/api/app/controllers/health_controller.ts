import mongoose from 'mongoose'
import type { HttpContext } from '@adonisjs/core/http'
import type { HealthResponse } from '@livepoll/shared'

export default class HealthController {
  async show({ response }: HttpContext) {
    const dbUp = mongoose.connection.readyState === mongoose.ConnectionStates.connected
    const body: HealthResponse = { status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' }
    return response.status(dbUp ? 200 : 503).send(body)
  }
}
