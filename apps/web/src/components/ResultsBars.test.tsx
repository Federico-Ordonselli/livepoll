import { render, screen } from '@testing-library/react'
import { ResultsBars } from './ResultsBars'

const options = [
  { id: 'a', label: 'Tabs', votes: 3 },
  { id: 'b', label: 'Spaces', votes: 1 },
  { id: 'c', label: 'Both', votes: 1 },
]

describe('ResultsBars', () => {
  it('describes every bar with votes and percentage', () => {
    render(<ResultsBars options={options} totalVotes={5} myVote={null} />)
    expect(screen.getByRole('img', { name: 'Tabs: 3 votes, 60%' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Spaces: 1 vote, 20%' })).toBeInTheDocument()
    expect(screen.getByText('5 votes total')).toBeInTheDocument()
  })

  it('marks the voter’s own choice', () => {
    render(<ResultsBars options={options} totalVotes={5} myVote="b" />)
    expect(screen.getByRole('img', { name: 'Spaces: 1 vote, 20% (your vote)' })).toBeInTheDocument()
  })

  it('shows 0% with no votes and announces changes politely', () => {
    const empty = options.map((option) => ({ ...option, votes: 0 }))
    render(<ResultsBars options={empty} totalVotes={0} myVote={null} />)
    expect(screen.getByRole('img', { name: 'Tabs: 0 votes, 0%' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Results' })).toHaveAttribute('aria-live', 'polite')
  })
})
