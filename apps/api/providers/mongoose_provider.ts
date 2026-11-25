import mongoose from 'mongoose'
import type { ApplicationService } from '@adonisjs/core/types'
import { Poll } from '#models/poll'
import { User } from '#models/user'
import { Vote } from '#models/vote'

/**
 * Connects Mongoose when the app starts and disconnects on shutdown.
 * Lucid is SQL-only, so MongoDB access lives here instead.
 */
export default class MongooseProvider {
  constructor(protected app: ApplicationService) {}

  async start() {
    // Ace commands (build, list:routes, ...) do not need a database.
    if (this.app.getEnvironment() === 'console') return

    const { default: env } = await import('#start/env')
    mongoose.set('strictQuery', true)
    // Defence in depth against operator injection (e.g. `{ "$ne": null }` in a filter).
    mongoose.set('sanitizeFilter', true)

    await mongoose.connect(env.get('MONGO_URL'), { serverSelectionTimeoutMS: 5000 })
    // Make sure unique indexes exist before the first request relies on them.
    await Promise.all([User.init(), Poll.init(), Vote.init()])
  }

  async shutdown() {
    await mongoose.disconnect()
  }
}
