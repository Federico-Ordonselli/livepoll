import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'
import { closePoll, createPoll, test } from './helpers'

const poll = { question: 'What should we drink?', options: ['Tea', 'Coffee'] }

for (const state of ['open', 'closed'] as const) {
  test(`the ${state} voting page passes WCAG A and AA axe checks`, async ({ creator, page }) => {
    const url = await createPoll(creator, poll)
    await page.goto(url)
    await expect(page.getByRole('group', { name: 'Pick one option' })).toBeVisible()
    if (state === 'closed') {
      await closePoll(creator, poll.question)
      await expect(page.getByText('This poll is closed. Voting has ended.')).toBeVisible()
    }
    await expect(page.getByRole('region', { name: 'Results' })).toHaveAttribute(
      'aria-live',
      'polite'
    )
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(violations).toEqual([])
  })
}

test('a voter can select and submit an option using only the keyboard', async ({
  creator,
  page,
}) => {
  const url = await createPoll(creator, poll)
  await page.goto(url)
  const group = page.getByRole('group', { name: 'Pick one option' })
  await expect(group).toBeVisible()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'LivePoll' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(group.getByRole('radio', { name: 'Tea' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(group.getByRole('radio', { name: 'Coffee' })).toBeChecked()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Vote', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('img', { name: 'Coffee: 1 vote, 100% (your vote)' })).toBeVisible()
})
