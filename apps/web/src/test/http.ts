import type { PollDTO } from '@livepoll/shared'

export function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Handler = (request: Request) => Response | Promise<Response>

/** Stubs global fetch with a "METHOD /path" -> handler table. Unknown requests fail loudly. */
export function mockFetch(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (request: Request) => {
    const key = `${request.method} ${new URL(request.url).pathname}`
    const handler = routes[key]
    if (!handler) throw new Error(`Unexpected request: ${key}`)
    return handler(request)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function makePoll(overrides: Partial<PollDTO> = {}): PollDTO {
  return {
    id: 'poll-1',
    slug: 'abcd1234',
    question: 'Tabs or spaces?',
    options: [
      { id: 'a', label: 'Tabs', votes: 3 },
      { id: 'b', label: 'Spaces', votes: 2 },
    ],
    allowVoteChange: false,
    status: 'open',
    totalVotes: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    closedAt: null,
    ...overrides,
  }
}
