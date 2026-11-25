import { withPercentages } from '@livepoll/shared'

it('can import the shared package', () => {
  expect(withPercentages([], 0)).toEqual([])
})
