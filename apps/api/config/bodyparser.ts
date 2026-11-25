import { defineConfig } from '@adonisjs/core/bodyparser'

/**
 * JSON only. Accepting form-urlencoded bodies would let a cross-site HTML
 * <form> submit to /api/auth/login (login CSRF), and multipart would write
 * uploaded files to disk before auth runs. This API has no use for either.
 */
const bodyParserConfig = defineConfig({
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  form: {
    convertEmptyStringsToNull: true,
    types: [],
  },
  json: {
    convertEmptyStringsToNull: true,
    limit: '100kb',
    types: ['application/json'],
  },
  multipart: {
    autoProcess: false,
    convertEmptyStringsToNull: true,
    processManually: [],
    limit: '1kb',
    types: [],
  },
})

export default bodyParserConfig
