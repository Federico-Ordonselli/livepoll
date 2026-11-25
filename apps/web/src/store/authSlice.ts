import { createSlice, isAnyOf } from '@reduxjs/toolkit'
import type { UserDTO } from '@livepoll/shared'
import { api } from './api'

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous'

export interface AuthState {
  user: UserDTO | null
  status: AuthStatus
  /** requestId of the `/me` check whose answer we still trust (null = superseded). */
  pendingCheck: string | null
}

const initialState: AuthState = { user: null, status: 'unknown', pendingCheck: null }

const { me, login, register, logout } = api.endpoints

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addMatcher(me.matchPending, (state, action) => {
        state.pendingCheck = action.meta.requestId
      })
      // A `/me` answer only counts if no login/register/logout happened while it was in
      // flight: an old "401" must not log out a user who has just logged in (and vice versa).
      .addMatcher(me.matchFulfilled, (state, action) => {
        if (action.meta.requestId !== state.pendingCheck) return
        state.pendingCheck = null
        state.user = action.payload.user
        state.status = 'authenticated'
      })
      .addMatcher(me.matchRejected, (state, action) => {
        // RTK Query also "rejects" a deduplicated request (meta.condition); that says nothing about the session.
        if (action.meta.condition || action.meta.requestId !== state.pendingCheck) return
        state.pendingCheck = null
        state.user = null
        state.status = 'anonymous'
      })
      .addMatcher(isAnyOf(login.matchFulfilled, register.matchFulfilled), (state, action) => {
        state.pendingCheck = null
        state.user = action.payload.user
        state.status = 'authenticated'
      })
      .addMatcher(logout.matchFulfilled, (state) => {
        state.pendingCheck = null
        state.user = null
        state.status = 'anonymous'
      })
  },
})
