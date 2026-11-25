import { jsonResponse, mockFetch } from '../test/http'
import { api } from './api'
import { makeStore } from './index'

const user = { id: 'u1', email: 'ada@example.com', createdAt: '2026-01-01T00:00:00.000Z' }
const unauthenticated = { error: { code: 'UNAUTHENTICATED', message: 'Not logged in' } }
const credentials = { email: 'ada@example.com', password: 'longenough' }

describe('auth slice', () => {
  it('starts unknown', () => {
    expect(makeStore().getState().auth.status).toBe('unknown')
  })

  it('me fulfilled -> authenticated', async () => {
    mockFetch({ 'GET /api/auth/me': () => jsonResponse(200, { user }) })
    const store = makeStore()
    await store.dispatch(api.endpoints.me.initiate())
    expect(store.getState().auth).toEqual({ user, status: 'authenticated', pendingCheck: null })
  })

  it('me rejected -> anonymous', async () => {
    mockFetch({ 'GET /api/auth/me': () => jsonResponse(401, unauthenticated) })
    const store = makeStore()
    await store.dispatch(api.endpoints.me.initiate())
    expect(store.getState().auth).toEqual({ user: null, status: 'anonymous', pendingCheck: null })
  })

  it('login and register fulfilled -> authenticated', async () => {
    mockFetch({
      'POST /api/auth/login': () => jsonResponse(200, { user }),
      'POST /api/auth/register': () => jsonResponse(201, { user }),
    })
    const loginStore = makeStore()
    await loginStore.dispatch(api.endpoints.login.initiate(credentials))
    expect(loginStore.getState().auth.status).toBe('authenticated')

    const registerStore = makeStore()
    await registerStore.dispatch(api.endpoints.register.initiate(credentials))
    expect(registerStore.getState().auth.user).toEqual(user)
  })

  it('failed login leaves the status unchanged', async () => {
    mockFetch({
      'POST /api/auth/login': () =>
        jsonResponse(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Wrong' } }),
    })
    const store = makeStore()
    await store.dispatch(api.endpoints.login.initiate(credentials))
    expect(store.getState().auth.status).toBe('unknown')
  })

  it('logout fulfilled -> anonymous', async () => {
    mockFetch({
      'GET /api/auth/me': () => jsonResponse(200, { user }),
      'POST /api/auth/logout': () => new Response(null, { status: 204 }),
    })
    const store = makeStore()
    await store.dispatch(api.endpoints.me.initiate())
    await store.dispatch(api.endpoints.logout.initiate())
    expect(store.getState().auth).toEqual({ user: null, status: 'anonymous', pendingCheck: null })
  })
})

describe('auth slice: stale session checks', () => {
  it('an old /me 401 arriving after a successful login does not log the user out', async () => {
    const { api } = await import('./api')
    const { authSlice } = await import('./authSlice')
    const user = { id: 'u1', email: 'ada@example.com', createdAt: '2026-01-01T00:00:00.000Z' }
    const meta = (endpointName: string, requestId: string, type: string) => ({
      requestId,
      arg: { endpointName, type },
    })
    let state = authSlice.reducer(undefined, {
      type: `${api.reducerPath}/executeQuery/pending`,
      meta: { ...meta('me', 'me-1', 'query'), requestStatus: 'pending' },
    } as never)
    state = authSlice.reducer(state, {
      type: `${api.reducerPath}/executeMutation/fulfilled`,
      payload: { user },
      meta: { ...meta('login', 'login-1', 'mutation'), requestStatus: 'fulfilled' },
    } as never)
    expect(state.status).toBe('authenticated')

    state = authSlice.reducer(state, {
      type: `${api.reducerPath}/executeQuery/rejected`,
      payload: { status: 401 },
      error: {},
      meta: { ...meta('me', 'me-1', 'query'), requestStatus: 'rejected', rejectedWithValue: true },
    } as never)
    expect(state.status).toBe('authenticated')
  })
})
