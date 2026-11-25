import { describe, expect, it } from 'vitest'
import { createPollSchema, credentialsSchema, pollRoomPayloadSchema } from './schemas.js'
import { withPercentages } from './results.js'
import { pollRoom } from './events.js'

describe('createPollSchema', () => {
  const valid = { question: 'Tabs or spaces?', options: ['Tabs', 'Spaces'] }

  it('accepts a valid poll and defaults allowVoteChange to false', () => {
    expect(createPollSchema.parse(valid)).toEqual({ ...valid, allowVoteChange: false })
  })

  it('rejects a question shorter than 3 chars', () => {
    expect(createPollSchema.safeParse({ ...valid, question: 'hi' }).success).toBe(false)
  })

  it('rejects fewer than 2 or more than 8 options', () => {
    expect(createPollSchema.safeParse({ ...valid, options: ['one'] }).success).toBe(false)
    const nine = Array.from({ length: 9 }, (_, i) => `opt ${i}`)
    expect(createPollSchema.safeParse({ ...valid, options: nine }).success).toBe(false)
  })

  it('rejects blank option labels after trimming', () => {
    expect(createPollSchema.safeParse({ ...valid, options: ['a', '   '] }).success).toBe(false)
  })
})

describe('credentialsSchema', () => {
  it('normalises email to lowercase', () => {
    const parsed = credentialsSchema.parse({ email: ' Ada@Example.COM ', password: 'longenough' })
    expect(parsed.email).toBe('ada@example.com')
  })

  it('rejects short passwords', () => {
    expect(credentialsSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false)
  })
})

describe('pollRoomPayloadSchema', () => {
  it('accepts 8-char url-safe slugs only', () => {
    expect(pollRoomPayloadSchema.safeParse({ slug: 'aB3_-x9Z' }).success).toBe(true)
    expect(pollRoomPayloadSchema.safeParse({ slug: 'short' }).success).toBe(false)
    expect(pollRoomPayloadSchema.safeParse({ slug: 'has space' }).success).toBe(false)
  })
})

describe('withPercentages', () => {
  it('computes rounded percentages', () => {
    const result = withPercentages(
      [
        { id: 'a', label: 'A', votes: 1 },
        { id: 'b', label: 'B', votes: 2 },
      ],
      3
    )
    expect(result.map((r) => r.percent)).toEqual([33, 67])
  })

  it('returns 0% when there are no votes', () => {
    expect(withPercentages([{ id: 'a', label: 'A', votes: 0 }], 0)[0]?.percent).toBe(0)
  })

  it('clamps negative transient counts to zero', () => {
    expect(withPercentages([{ id: 'a', label: 'A', votes: -1 }], 1)[0]?.votes).toBe(0)
  })
})

describe('pollRoom', () => {
  it('prefixes the slug', () => {
    expect(pollRoom('abcdefgh')).toBe('poll:abcdefgh')
  })
})
