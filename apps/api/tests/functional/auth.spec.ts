import { test } from '@japa/runner'
import env from '#start/env'
import { User } from '#models/user'
import { registerUser, resetState, uniqueEmail } from '#tests/helpers'

test.group('Auth', (group) => {
  group.each.setup(() => resetState())

  test('register creates a user, logs them in and never exposes the hash', async ({
    client,
    assert,
  }) => {
    const response = await client
      .post('/api/auth/register')
      .json({ email: '  Ada@Example.COM ', password: 'password123' })

    response.assertStatus(201)
    assert.equal(response.body().user.email, 'ada@example.com')
    assert.notProperty(response.body().user, 'passwordHash')

    const stored = await User.findOne({ email: 'ada@example.com' }).lean()
    assert.isNotNull(stored)
    assert.notEqual(stored!.passwordHash, 'password123')

    const setCookie = String(response.header('set-cookie'))
    assert.include(setCookie, 'lp_session=')
    assert.include(setCookie, 'HttpOnly')
    assert.include(setCookie, 'SameSite=Lax')
  })

  test('register rejects a duplicate email with 409', async ({ client }) => {
    const { email } = await registerUser(client)
    const response = await client
      .post('/api/auth/register')
      .json({ email: email.toUpperCase(), password: 'password123' })
    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'EMAIL_TAKEN' } })
  })

  test('register validates input', async ({ client, assert }) => {
    const response = await client
      .post('/api/auth/register')
      .json({ email: 'not-an-email', password: 'short' })
    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'VALIDATION_ERROR' } })
    const fields = response.body().error.details.map((d: { field: string }) => d.field)
    assert.sameMembers(fields, ['email', 'password'])
  })

  test('login with correct credentials sets a session that /me accepts', async ({
    client,
    assert,
  }) => {
    const { email } = await registerUser(client)
    const login = await client.post('/api/auth/login').json({ email, password: 'password123' })
    login.assertStatus(200)

    const me = await client
      .get('/api/auth/me')
      .withCookie('lp_session', login.cookie('lp_session')!.value)
    me.assertStatus(200)
    assert.equal(me.body().user.email, email)
  })

  test('login with a wrong password or unknown email returns 401', async ({ client }) => {
    const { email } = await registerUser(client)
    const wrongPassword = await client
      .post('/api/auth/login')
      .json({ email, password: 'wrong-password' })
    wrongPassword.assertStatus(401)
    wrongPassword.assertBodyContains({ error: { code: 'INVALID_CREDENTIALS' } })

    const unknown = await client
      .post('/api/auth/login')
      .json({ email: uniqueEmail(), password: 'password123' })
    unknown.assertStatus(401)
    unknown.assertBodyContains({ error: { code: 'INVALID_CREDENTIALS' } })
  })

  test('/me is 401 without a session, with a forged cookie, or with an expired one', async ({
    client,
  }) => {
    const anonymous = await client.get('/api/auth/me')
    anonymous.assertStatus(401)

    // Unsigned cookie: the signature check fails, so it is ignored.
    const forged = await client
      .get('/api/auth/me')
      .header('cookie', 'lp_session=' + encodeURIComponent(JSON.stringify({ uid: 'x', exp: 1e15 })))
    forged.assertStatus(401)

    const { user } = await registerUser(client)
    const expired = await client
      .get('/api/auth/me')
      .withCookie('lp_session', { uid: user.id, exp: Date.now() - 1000 })
    expired.assertStatus(401)
  })

  test('logout clears the session cookie', async ({ client, assert }) => {
    const response = await client.post('/api/auth/logout')
    response.assertStatus(204)
    assert.match(String(response.header('set-cookie')), /lp_session=;.*Expires=Thu, 01 Jan 1970/)
  })

  test('login is rate limited per IP', async ({ client }) => {
    const original = env.get('RATE_LIMIT_AUTH_PER_MIN')
    env.set('RATE_LIMIT_AUTH_PER_MIN', 3)
    try {
      for (let i = 0; i < 3; i++) {
        const r = await client.post('/api/auth/login').json({ email: 'a@b.co', password: 'x' })
        r.assertStatus(422)
      }
      const limited = await client.post('/api/auth/login').json({ email: 'a@b.co', password: 'x' })
      limited.assertStatus(429)
      limited.assertBodyContains({ error: { code: 'RATE_LIMITED' } })
      limited.assertHeader('retry-after', limited.header('retry-after'))
    } finally {
      env.set('RATE_LIMIT_AUTH_PER_MIN', original)
    }
  })
})
