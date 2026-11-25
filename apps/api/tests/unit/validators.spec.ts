import { test } from '@japa/runner'
import { createPollSchema, credentialsSchema } from '@livepoll/shared'
import { credentialsValidator } from '#validators/auth'
import { createPollValidator } from '#validators/poll'

/**
 * The API validates with VineJS, the web app with zod. Both are built from the
 * same LIMITS; this test keeps them in agreement on the edge cases.
 */
async function vineAccepts(
  validator: { validate: (data: unknown) => Promise<unknown> },
  data: unknown
) {
  try {
    await validator.validate(data)
    return true
  } catch {
    return false
  }
}

const pollCases = [
  { question: 'Why', options: ['a', 'b'] },
  { question: 'hi', options: ['a', 'b'] },
  { question: 'x'.repeat(200), options: ['a', 'b'] },
  { question: 'x'.repeat(201), options: ['a', 'b'] },
  { question: 'Valid?', options: ['a'] },
  { question: 'Valid?', options: Array.from({ length: 8 }, (_, i) => `${i}`) },
  { question: 'Valid?', options: Array.from({ length: 9 }, (_, i) => `${i}`) },
  { question: 'Valid?', options: ['a', 'x'.repeat(100)] },
  { question: 'Valid?', options: ['a', 'x'.repeat(101)] },
  { question: '   ab   ', options: ['a', 'b'] },
  { question: 'Valid?', options: ['a', 'b'], allowVoteChange: true },
]

const credentialCases = [
  { email: 'ada@example.com', password: 'password' },
  { email: 'ada@example.com', password: 'short' },
  { email: 'ada@example.com', password: 'x'.repeat(129) },
  { email: 'not-an-email', password: 'password' },
  { email: '  ADA@EXAMPLE.COM ', password: 'password' },
  { email: 'josé@example.com', password: 'password' },
  { email: 'ada+tag@example.co.uk', password: 'password' },
]

test.group('VineJS and zod validators agree', () => {
  test('poll payload {$i}')
    .with(pollCases)
    .run(async ({ assert }, payload) => {
      assert.equal(
        await vineAccepts(createPollValidator, payload),
        createPollSchema.safeParse(payload).success
      )
    })

  test('credentials payload {$i}')
    .with(credentialCases)
    .run(async ({ assert }, payload) => {
      assert.equal(
        await vineAccepts(credentialsValidator, payload),
        credentialsSchema.safeParse(payload).success
      )
    })
})
