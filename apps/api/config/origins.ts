import env from '#start/env'

/** Allow-list shared by HTTP CORS and Socket.io CORS. */
export const allowedOrigins = env
  .get('CORS_ORIGINS')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
