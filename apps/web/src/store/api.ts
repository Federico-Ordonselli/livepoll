/* eslint-disable @typescript-eslint/no-invalid-void-type -- RTK Query uses `void` for endpoints without an argument */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type {
  AuthResponse,
  CreatePollInput,
  CredentialsInput,
  MyPollsResponse,
  PollResponse,
  PollWithVoteResponse,
} from '@livepoll/shared'

export const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/api', credentials: 'include' }),
  tagTypes: ['Poll', 'MyPolls'],
  endpoints: (build) => ({
    me: build.query<AuthResponse, void>({ query: () => '/auth/me' }),
    login: build.mutation<AuthResponse, CredentialsInput>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    register: build.mutation<AuthResponse, CredentialsInput>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      // Drop every cached response: they belong to the previous user (own polls, myVote).
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        await queryFulfilled
        dispatch(api.util.resetApiState())
      },
    }),
    getPoll: build.query<PollWithVoteResponse, string>({
      query: (slug) => `/polls/${slug}`,
      providesTags: (_result, _error, slug) => [{ type: 'Poll', id: slug }],
    }),
    vote: build.mutation<PollWithVoteResponse, { slug: string; optionId: string }>({
      query: ({ slug, optionId }) => ({
        url: `/polls/${slug}/vote`,
        method: 'POST',
        body: { optionId },
      }),
    }),
    createPoll: build.mutation<PollResponse, CreatePollInput>({
      query: (body) => ({ url: '/polls', method: 'POST', body }),
      invalidatesTags: ['MyPolls'],
    }),
    myPolls: build.query<MyPollsResponse, void>({
      query: () => '/polls/mine',
      providesTags: ['MyPolls'],
    }),
    closePoll: build.mutation<PollResponse, string>({
      query: (slug) => ({ url: `/polls/${slug}/close`, method: 'POST' }),
      invalidatesTags: (_result, _error, slug) => ['MyPolls', { type: 'Poll', id: slug }],
    }),
  }),
})

export const {
  useMeQuery,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetPollQuery,
  useVoteMutation,
  useCreatePollMutation,
  useMyPollsQuery,
  useClosePollMutation,
} = api
