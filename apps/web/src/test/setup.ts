import '@testing-library/jest-dom/vitest'

// Node's Request (used by RTK Query's fetchBaseQuery) rejects relative URLs like '/api/...'.
// Browsers resolve them against the page; do the same against jsdom's location.
const NodeRequest = globalThis.Request
globalThis.Request = class extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === 'string' ? new URL(input, location.origin) : input, init)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})
