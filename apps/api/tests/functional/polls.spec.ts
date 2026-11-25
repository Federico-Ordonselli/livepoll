import { test } from '@japa/runner'
import { createPoll, registerUser, resetState } from '#tests/helpers'

test.group('Polls: create, list, show, close', (group) => {
  group.each.setup(() => resetState())

  test('a creator can create a poll and gets an 8-char url-safe slug', async ({
    client,
    assert,
  }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session, {
      question: '  Best editor?  ',
      options: [' Vim ', 'Emacs'],
      allowVoteChange: true,
    })

    assert.match(poll.slug, /^[A-Za-z0-9_-]{8}$/)
    assert.equal(poll.question, 'Best editor?')
    assert.deepEqual(
      poll.options.map((o) => [o.label, o.votes]),
      [
        ['Vim', 0],
        ['Emacs', 0],
      ]
    )
    assert.isTrue(poll.allowVoteChange)
    assert.equal(poll.status, 'open')
    assert.equal(poll.totalVotes, 0)
    assert.notProperty(poll, 'ownerId')
  })

  test('creating a poll requires authentication', async ({ client }) => {
    const response = await client
      .post('/api/polls')
      .json({ question: 'Tabs or spaces?', options: ['Tabs', 'Spaces'] })
    response.assertStatus(401)
    response.assertBodyContains({ error: { code: 'UNAUTHENTICATED' } })
  })

  test('poll creation validates {input}')
    .with([
      { input: 'a too short question', body: { question: 'hi', options: ['a', 'b'] } },
      { input: 'a too long question', body: { question: 'x'.repeat(201), options: ['a', 'b'] } },
      { input: 'a single option', body: { question: 'Valid question', options: ['a'] } },
      {
        input: 'nine options',
        body: { question: 'Valid question', options: Array.from({ length: 9 }, (_, i) => `${i}`) },
      },
      { input: 'a blank option', body: { question: 'Valid question', options: ['a', '   '] } },
      {
        input: 'a too long option',
        body: { question: 'Valid question', options: ['a', 'x'.repeat(101)] },
      },
      { input: 'a missing body', body: {} },
    ])
    .run(async ({ client }, { body }) => {
      const { session } = await registerUser(client)
      const response = await client.post('/api/polls').withCookie('lp_session', session).json(body)
      response.assertStatus(422)
      response.assertBodyContains({ error: { code: 'VALIDATION_ERROR' } })
    })

  test('accepts the boundary values (3-char question, 8 options of 100 chars)', async ({
    client,
  }) => {
    const { session } = await registerUser(client)
    await createPoll(client, session, {
      question: 'Why',
      options: Array.from({ length: 8 }, (_, i) => `${i}`.padEnd(100, 'x')),
    })
  })

  test('GET /api/polls/mine lists only my polls, newest first', async ({ client, assert }) => {
    const alice = await registerUser(client)
    const bob = await registerUser(client)
    const first = await createPoll(client, alice.session, { question: 'First poll' })
    const second = await createPoll(client, alice.session, { question: 'Second poll' })
    await createPoll(client, bob.session, { question: 'Bob poll' })

    const response = await client.get('/api/polls/mine').withCookie('lp_session', alice.session)
    response.assertStatus(200)
    assert.deepEqual(
      response.body().polls.map((p: { slug: string }) => p.slug),
      [second.slug, first.slug]
    )
  })

  test('anyone can read a poll by slug; unknown or malformed slugs are 404', async ({
    client,
    assert,
  }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session)

    const response = await client.get(`/api/polls/${poll.slug}`)
    response.assertStatus(200)
    assert.equal(response.body().poll.slug, poll.slug)
    assert.isNull(response.body().myVote)
    assert.include(String(response.header('set-cookie')), 'voter_id=')

    const unknown = await client.get('/api/polls/zzzzzzzz')
    unknown.assertStatus(404)
    const malformed = await client.get('/api/polls/not-a-valid-slug')
    malformed.assertStatus(404)
    malformed.assertBodyContains({ error: { code: 'NOT_FOUND' } })
  })

  test('only the owner can close a poll (others get 403)', async ({ client, assert }) => {
    const owner = await registerUser(client)
    const stranger = await registerUser(client)
    const poll = await createPoll(client, owner.session)

    const forbidden = await client
      .post(`/api/polls/${poll.slug}/close`)
      .withCookie('lp_session', stranger.session)
    forbidden.assertStatus(403)
    forbidden.assertBodyContains({ error: { code: 'FORBIDDEN' } })

    const anonymous = await client.post(`/api/polls/${poll.slug}/close`)
    anonymous.assertStatus(401)

    const closed = await client
      .post(`/api/polls/${poll.slug}/close`)
      .withCookie('lp_session', owner.session)
    closed.assertStatus(200)
    assert.equal(closed.body().poll.status, 'closed')
    assert.isString(closed.body().poll.closedAt)

    // Closing again is a harmless no-op.
    const again = await client
      .post(`/api/polls/${poll.slug}/close`)
      .withCookie('lp_session', owner.session)
    again.assertStatus(200)
    assert.equal(again.body().poll.closedAt, closed.body().poll.closedAt)
  })

  test('closing an unknown poll is 404', async ({ client }) => {
    const { session } = await registerUser(client)
    const response = await client
      .post('/api/polls/zzzzzzzz/close')
      .withCookie('lp_session', session)
    response.assertStatus(404)
  })
})
