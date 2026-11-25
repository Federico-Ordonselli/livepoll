import { test } from '@japa/runner'
import { Types } from 'mongoose'
import { Poll } from '#models/poll'
import { Vote } from '#models/vote'
import { createPoll, newVoterId, registerUser, resetState, vote } from '#tests/helpers'

/** Counters on the poll must always equal what the votes collection says. */
async function assertCountersMatchVotes(
  assert: import('@japa/assert').Assert,
  slug: string,
  expectedTotal: number
) {
  const poll = await Poll.findOne({ slug }).lean()
  const votes = await Vote.find({ pollId: poll!._id }).lean()
  assert.equal(votes.length, expectedTotal, 'number of vote documents')
  assert.equal(poll!.totalVotes, expectedTotal, 'totalVotes counter')
  for (const option of poll!.options) {
    const actual = votes.filter((v) => v.optionId.equals(option._id)).length
    assert.equal(option.votes, actual, `counter for option "${option.label}"`)
  }
  return poll!
}

test.group('Votes', (group) => {
  group.each.setup(() => resetState())

  test('a voter can vote once and sees their vote and the new counts', async ({
    client,
    assert,
  }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session)
    const voterId = newVoterId()

    const response = await vote(client, poll.slug, poll.options[1]!.id, voterId)
    response.assertStatus(200)
    assert.equal(response.body().myVote, poll.options[1]!.id)
    assert.equal(response.body().poll.totalVotes, 1)
    assert.equal(response.body().poll.options[1].votes, 1)

    const show = await client.get(`/api/polls/${poll.slug}`).withCookie('voter_id', voterId)
    assert.equal(show.body().myVote, poll.options[1]!.id)
  })

  test('the first vote sets a voter_id cookie when the voter has none', async ({
    client,
    assert,
  }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session)
    const response = await client
      .post(`/api/polls/${poll.slug}/vote`)
      .json({ optionId: poll.options[0]!.id })
    response.assertStatus(200)
    const cookie = String(response.header('set-cookie'))
    assert.include(cookie, 'voter_id=')
    assert.include(cookie, 'HttpOnly')
  })

  test('a forged (unsigned) voter_id is ignored and replaced', async ({ client, assert }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session)
    const victim = newVoterId()
    await vote(client, poll.slug, poll.options[0]!.id, victim)

    // Sending the victim's id without a valid signature must not act as the victim.
    const response = await client
      .post(`/api/polls/${poll.slug}/vote`)
      .header('cookie', `voter_id=${victim}`)
      .json({ optionId: poll.options[1]!.id })
    response.assertStatus(200)
    assert.equal(await Vote.countDocuments({ voterId: victim }), 1)
    await assertCountersMatchVotes(assert, poll.slug, 2)
  })

  test('voting twice returns 409 ALREADY_VOTED when changes are not allowed', async ({
    client,
    assert,
  }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session)
    const voterId = newVoterId()

    const first = await vote(client, poll.slug, poll.options[0]!.id, voterId)
    first.assertStatus(200)
    const second = await vote(client, poll.slug, poll.options[1]!.id, voterId)
    second.assertStatus(409)
    second.assertBodyContains({ error: { code: 'ALREADY_VOTED' } })

    const stored = await assertCountersMatchVotes(assert, poll.slug, 1)
    assert.equal(stored.options[0]!.votes, 1)
  })

  test('when allowed, voting again moves the vote and adjusts both counters', async ({
    client,
    assert,
  }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session, { allowVoteChange: true })
    const voterId = newVoterId()

    await vote(client, poll.slug, poll.options[0]!.id, voterId)
    const changed = await vote(client, poll.slug, poll.options[2]!.id, voterId)
    changed.assertStatus(200)
    assert.equal(changed.body().myVote, poll.options[2]!.id)
    assert.deepEqual(
      changed.body().poll.options.map((o: { votes: number }) => o.votes),
      [0, 0, 1]
    )
    assert.equal(changed.body().poll.totalVotes, 1)

    // Re-voting for the same option is a no-op.
    const same = await vote(client, poll.slug, poll.options[2]!.id, voterId)
    same.assertStatus(200)
    await assertCountersMatchVotes(assert, poll.slug, 1)
  })

  test('voting on a closed poll returns 409 POLL_CLOSED; the poll stays readable', async ({
    client,
    assert,
  }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session, { allowVoteChange: true })
    const voterId = newVoterId()
    await vote(client, poll.slug, poll.options[0]!.id, voterId)
    await client.post(`/api/polls/${poll.slug}/close`).withCookie('lp_session', session)

    const newVoter = await vote(client, poll.slug, poll.options[0]!.id, newVoterId())
    newVoter.assertStatus(409)
    newVoter.assertBodyContains({ error: { code: 'POLL_CLOSED' } })

    // Changing a vote is blocked too, even though the poll allows changes.
    const change = await vote(client, poll.slug, poll.options[1]!.id, voterId)
    change.assertStatus(409)
    change.assertBodyContains({ error: { code: 'POLL_CLOSED' } })

    const show = await client.get(`/api/polls/${poll.slug}`).withCookie('voter_id', voterId)
    show.assertStatus(200)
    assert.equal(show.body().poll.status, 'closed')
    assert.equal(show.body().myVote, poll.options[0]!.id)
    await assertCountersMatchVotes(assert, poll.slug, 1)
  })

  test('an option of another poll, or a malformed id, is rejected with 422', async ({ client }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session)
    const other = await createPoll(client, session)

    const foreign = await vote(client, poll.slug, other.options[0]!.id, newVoterId())
    foreign.assertStatus(422)
    foreign.assertBodyContains({ error: { code: 'INVALID_OPTION' } })

    const random = await vote(client, poll.slug, new Types.ObjectId().toString(), newVoterId())
    random.assertStatus(422)

    const garbage = await vote(client, poll.slug, 'not-an-id', newVoterId())
    garbage.assertStatus(422)

    const missing = await client.post(`/api/polls/${poll.slug}/vote`).json({})
    missing.assertStatus(422)
    missing.assertBodyContains({ error: { code: 'VALIDATION_ERROR' } })
  })

  test('voting on an unknown poll is 404', async ({ client }) => {
    const response = await vote(client, 'zzzzzzzz', new Types.ObjectId().toString(), newVoterId())
    response.assertStatus(404)
  })

  test('the vote endpoint rejects operator injection in the body', async ({ client }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session)
    const response = await client
      .post(`/api/polls/${poll.slug}/vote`)
      .json({ optionId: { $ne: null } })
    response.assertStatus(422)
  })
})

test.group('Votes under concurrency', (group) => {
  group.each.setup(() => resetState())
  group.each.timeout(30_000)

  test('50 parallel votes from distinct voters are all counted exactly once', async ({
    client,
    assert,
  }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session)

    const responses = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        vote(client, poll.slug, poll.options[i % 3]!.id, newVoterId())
      )
    )

    assert.isTrue(responses.every((r) => r.status() === 200))
    const stored = await assertCountersMatchVotes(assert, poll.slug, 50)
    assert.deepEqual(
      stored.options.map((o) => o.votes),
      [17, 17, 16]
    )
  })

  test('20 parallel votes from the SAME voter: exactly one succeeds, 19 get 409', async ({
    client,
    assert,
  }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session)
    const voterId = newVoterId()

    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        vote(client, poll.slug, poll.options[i % 3]!.id, voterId)
      )
    )

    const statuses = responses.map((r) => r.status())
    assert.equal(statuses.filter((s) => s === 200).length, 1)
    assert.equal(statuses.filter((s) => s === 409).length, 19)
    assert.equal(await Vote.countDocuments({ voterId }), 1)
    await assertCountersMatchVotes(assert, poll.slug, 1)
  })

  test('20 parallel vote CHANGES from the same voter leave one vote and consistent counters', async ({
    client,
    assert,
  }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session, { allowVoteChange: true })
    const voterId = newVoterId()

    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        vote(client, poll.slug, poll.options[i % 3]!.id, voterId)
      )
    )

    // Every request either succeeded or was told to retry; none crashed.
    assert.isTrue(responses.every((r) => r.status() === 200 || r.status() === 409))
    assert.isTrue(responses.some((r) => r.status() === 200))
    assert.equal(await Vote.countDocuments({ voterId }), 1)
    await assertCountersMatchVotes(assert, poll.slug, 1)
  })

  test('mixed load: 50 distinct voters + 20 duplicate requests from one voter', async ({
    client,
    assert,
  }) => {
    const { session } = await registerUser(client)
    const poll = await createPoll(client, session)
    const repeatVoter = newVoterId()

    const requests = [
      ...Array.from({ length: 50 }, (_, i) =>
        vote(client, poll.slug, poll.options[i % 3]!.id, newVoterId())
      ),
      ...Array.from({ length: 20 }, () =>
        vote(client, poll.slug, poll.options[0]!.id, repeatVoter)
      ),
    ]
    const responses = await Promise.all(requests)

    assert.equal(responses.filter((r) => r.status() === 200).length, 51)
    assert.equal(responses.filter((r) => r.status() === 409).length, 19)
    await assertCountersMatchVotes(assert, poll.slug, 51)
  })
})
