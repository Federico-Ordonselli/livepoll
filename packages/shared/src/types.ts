export type PollStatus = 'open' | 'closed'

export interface PollOptionDTO {
  id: string
  label: string
  votes: number
}

/** Public representation of a poll. Never contains the owner id or voter ids. */
export interface PollDTO {
  id: string
  slug: string
  question: string
  options: PollOptionDTO[]
  allowVoteChange: boolean
  status: PollStatus
  totalVotes: number
  createdAt: string
  closedAt: string | null
}

export interface UserDTO {
  id: string
  email: string
  createdAt: string
}

/* ---------- REST response bodies ---------- */

export interface AuthResponse {
  user: UserDTO
}

/** GET /api/polls/:slug and POST /api/polls/:slug/vote */
export interface PollWithVoteResponse {
  poll: PollDTO
  /** Option id this voter picked, or null if they have not voted. */
  myVote: string | null
}

export interface PollResponse {
  poll: PollDTO
}

export interface MyPollsResponse {
  polls: PollDTO[]
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  db: 'up' | 'down'
}

/* ---------- Errors ---------- */

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'ALREADY_VOTED',
  'POLL_CLOSED',
  'INVALID_OPTION',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export interface FieldError {
  field: string
  message: string
}

/** Every non-2xx API response has this shape. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode
    message: string
    details?: FieldError[]
  }
}
