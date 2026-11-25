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

test.group('CSRF and body parsing', () => {
  const url = () => `http://${env.get('HOST')}:${env.get('PORT')}/api/auth/login`

  test('a POST from a foreign origin is rejected before the handler runs', async ({ client }) => {
    const response = await client
      .post('/api/auth/login')
      .header('origin', 'https://evil.example')
      .json({ email: 'a@b.co', password: 'password123' })
    response.assertStatus(403)
    response.assertBodyContains({ error: { code: 'FORBIDDEN' } })
  })

  test('an HTML form post (urlencoded) cannot log anyone in', async ({ assert }) => {
    const response = await fetch(url(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'email=a%40b.co&password=password123',
    })
    assert.equal(response.status, 422)
    assert.isNull(response.headers.get('set-cookie'))
  })

  test('a JSON scalar body is a 422, not a 500', async ({ assert }) => {
    const response = await fetch(url(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'null',
    })
    assert.equal(response.status, 422)
    const body = (await response.json()) as { error: { code: string } }
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })
})
