import { test } from '@japa/runner'
import env from '#start/env'

test.group('Health and errors', () => {
  test('GET /api/health reports the database as up', async ({ client }) => {
    const response = await client.get('/api/health')
    response.assertStatus(200)
    response.assertBody({ status: 'ok', db: 'up' })
  })

  test('unknown routes use the standard error format and security headers', async ({ client }) => {
    const response = await client.get('/api/does-not-exist')
    response.assertStatus(404)
    response.assertBody({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    response.assertHeader('x-content-type-options', 'nosniff')
    response.assertHeader('x-frame-options', 'DENY')
  })

  test('malformed JSON is a 400 without leaking parser internals', async ({ assert }) => {
    // Raw fetch: the test client would re-serialize the string into valid JSON.
    const response = await fetch(`http://${env.get('HOST')}:${env.get('PORT')}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"email": ',
    })
    assert.equal(response.status, 400)
    const body = await response.text()
    assert.deepEqual(JSON.parse(body), {
      error: { code: 'VALIDATION_ERROR', message: 'Bad request' },
    })
    assert.notInclude(body, 'stack')
  })

  test('CORS allows the configured origin and rejects others', async ({ client, assert }) => {
    const allowed = await client.get('/api/health').header('origin', 'http://localhost:5173')
    allowed.assertHeader('access-control-allow-origin', 'http://localhost:5173')
    allowed.assertHeader('access-control-allow-credentials', 'true')

    const denied = await client.get('/api/health').header('origin', 'https://evil.example')
    assert.isUndefined(denied.header('access-control-allow-origin'))
  })
})
