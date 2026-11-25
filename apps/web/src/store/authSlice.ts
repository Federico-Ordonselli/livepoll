import { createSlice, isAnyOf } from '@reduxjs/toolkit'
import type { UserDTO } from '@livepoll/shared'
import { api } from './api'

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous'

export interface AuthState {
  user: UserDTO | null
  status: AuthStatus
}

const initialState: AuthState = { user: null, status: 'unknown' }

const { me, login, register, logout } = api.endpoints

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addMatcher(
        isAnyOf(me.matchFulfilled, login.matchFulfilled, register.matchFulfilled),
        (state, action) => {
          state.user = action.payload.user
          state.status = 'authenticated'
        }
      )
      .addMatcher(isAnyOf(me.matchRejected, logout.matchFulfilled), (state, action) => {
        // RTK Query also "rejects" a deduplicated request (meta.condition); that says nothing about the session.
        if ('condition' in action.meta && action.meta.condition) return
        state.user = null
        state.status = 'anonymous'
      })
  },
})
