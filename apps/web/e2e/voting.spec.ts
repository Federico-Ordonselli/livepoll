import { expect } from '@playwright/test'
import { closePoll, createPoll, test, vote } from './helpers'

test('three viewers receive live presence, vote totals and poll closure', async ({
  browser,
  creator,
}) => {
  const question = 'Which language should we use?'
  const url = await createPoll(creator, { question, options: ['Go', 'Rust'], allowChange: true })
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  try {
    const first = await firstContext.newPage()
    const second = await secondContext.newPage()
    await Promise.all([first.goto(url), second.goto(url)])
    for (const page of [creator, first, second]) {
      await expect(page.getByText('3 people viewing', { exact: true })).toBeVisible()
    }

    await vote(first, 'Go')
    await expect(second.getByRole('img', { name: 'Go: 1 vote, 100%', exact: true })).toBeVisible()
    await vote(second, 'Rust')
    for (const page of [creator, first, second]) {
      const results = page.getByRole('region', { name: 'Results' })
      const go = page === first ? 'Go: 1 vote, 50% (your vote)' : 'Go: 1 vote, 50%'
      const rust = page === second ? 'Rust: 1 vote, 50% (your vote)' : 'Rust: 1 vote, 50%'
      await expect(results.getByRole('img', { name: go, exact: true })).toBeVisible()
      await expect(results.getByRole('img', { name: rust, exact: true })).toBeVisible()
      await expect(results.getByText('2 votes total', { exact: true })).toBeVisible()
    }

    for (const voter of [first, second]) {
      await expect(voter.getByRole('button', { name: 'Change vote' })).toBeVisible()
    }
    await closePoll(creator, question)
    for (const voter of [first, second]) {
      await expect(voter.getByText('This poll is closed. Voting has ended.')).toBeVisible()
      await expect(voter.getByRole('radio')).toHaveCount(0)
      await expect(voter.getByRole('button', { name: /^(change )?vote$/i })).toHaveCount(0)
    }
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()])
  }
})

test('a voter returning to a fixed vote poll cannot vote twice', async ({ creator, page }) => {
  const url = await createPoll(creator, {
    question: 'Where should we meet?',
    options: ['Park', 'Cafe'],
  })
  await page.goto(url)
  await vote(page, 'Park')
  const myBar = page.getByRole('img', { name: 'Park: 1 vote, 100% (your vote)', exact: true })
  await expect(myBar).toBeVisible()

  await page.reload()
  await expect(
    page.getByText('You voted for Park. Votes cannot be changed in this poll.')
  ).toBeVisible()
  await expect(myBar).toBeVisible()
  await expect(page.getByText('1 vote total', { exact: true })).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^(change )?vote$/i })).toHaveCount(0)
})

test('changing a vote moves the single vote to the new option', async ({ creator, page }) => {
  const url = await createPoll(creator, {
    question: 'Which session?',
    options: ['Morning', 'Evening'],
    allowChange: true,
  })
  await page.goto(url)
  await vote(page, 'Morning')
  await expect(page.getByRole('img', { name: 'Morning: 1 vote, 100% (your vote)' })).toBeVisible()

  await page
    .getByRole('group', { name: 'Change your vote' })
    .getByRole('radio', { name: 'Evening' })
    .check()
  await page.getByRole('button', { name: 'Change vote' }).click()
  await expect(page.getByRole('img', { name: 'Morning: 0 votes, 0%', exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Evening: 1 vote, 100% (your vote)' })).toBeVisible()
  await expect(page.getByText('1 vote total', { exact: true })).toBeVisible()
})
