import { defineConfig, stores } from '@adonisjs/limiter'

/**
 * In-memory store: fine for a single API instance. Running several instances
 * would need the Redis store so they share counters.
 */
const limiterConfig = defineConfig({
  default: 'memory',
  stores: {
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
