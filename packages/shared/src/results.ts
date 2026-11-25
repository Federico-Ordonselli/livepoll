import type { PollOptionDTO } from './types.js'

export interface OptionResult extends PollOptionDTO {
  percent: number
}

/**
 * Adds an integer percentage to every option. Negative transient counts
 * (possible for a few ms during concurrent vote changes) are clamped to 0.
 */
export function withPercentages(options: PollOptionDTO[], totalVotes: number): OptionResult[] {
  return options.map((option) => {
    const votes = Math.max(0, option.votes)
    const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
    return { ...option, votes, percent }
  })
}
