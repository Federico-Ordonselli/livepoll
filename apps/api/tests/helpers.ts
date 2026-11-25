import { randomUUID } from 'node:crypto'
import type { ApiClient } from '@japa/api-client'
import limiter from '@adonisjs/limiter/services/main'
import type { PollDTO } from '@livepoll/shared'
import { Poll } from '#models/poll'
import { User } from '#models/user'
import { Vote } from '#models/vote'

export async function resetState() {
  await Promise.all([User.deleteMany({}), Poll.deleteMany({}), Vote.deleteMany({})])
  await limiter.clear()
}

export interface Session {
  name: string
  value: unknown
}

let counter = 0
export function uniqueEmail() {
  counter += 1
  return `user${counter}-${Date.now()}@example.com`
}

/** Registers a user and returns its session cookie, ready for `.withCookie()`. */
export async function registerUser(client: ApiClient, email = uniqueEmail()) {
  const response = await client.post('/api/auth/register').json({ email, password: 'password123' })
  response.assertStatus(201)
  const cookie = response.cookie('lp_session')
  if (!cookie) throw new Error('register did not set a session cookie')
  return { email, session: cookie.value as unknown, user: response.body().user }
}

export async function createPoll(
  client: ApiClient,
  session: unknown,
  overrides: Partial<{ question: string; options: string[]; allowVoteChange: boolean }> = {}
): Promise<PollDTO> {
  const response = await client
    .post('/api/polls')
    .withCookie('lp_session', session)
    .json({ question: 'Tabs or spaces?', options: ['Tabs', 'Spaces', 'Both'], ...overrides })
  response.assertStatus(201)
  return response.body().poll
}

export function newVoterId() {
  return randomUUID()
}

export function vote(client: ApiClient, slug: string, optionId: string, voterId: string) {
  return client.post(`/api/polls/${slug}/vote`).withCookie('voter_id', voterId).json({ optionId })
}
