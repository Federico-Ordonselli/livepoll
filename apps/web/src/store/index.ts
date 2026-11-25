import { combineSlices, configureStore } from '@reduxjs/toolkit'
import { io } from 'socket.io-client'
import { api } from './api'
import { authSlice } from './authSlice'
import { pollSlice } from './pollSlice'
import { createSocketMiddleware, type PollSocket } from './socketMiddleware'

const rootReducer = combineSlices(api, authSlice, pollSlice)

export type RootState = ReturnType<typeof rootReducer>

export interface StoreDeps {
  createSocket: () => PollSocket
}

// Same origin: Vite proxies /socket.io to the API, so the session cookie is sent.
const defaultDeps: StoreDeps = {
  createSocket: () => io({ withCredentials: true, autoConnect: false }),
}

export function makeStore(preloadedState?: Partial<RootState>, deps: StoreDeps = defaultDeps) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefault) =>
      getDefault().concat(api.middleware, createSocketMiddleware(deps.createSocket)),
  })
}

export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore['dispatch']
