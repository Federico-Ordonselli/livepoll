import { randomUUID } from 'node:crypto'
import { expect, test as base, type Page } from '@playwright/test'

export async function registerCreator(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create an account' }).click()
  await page.getByLabel('Email', { exact: true }).fill(`creator-${randomUUID()}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('LivePoll-test-password')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your polls' })).toBeVisible()
}

interface PollInput {
  question: string
  options: string[]
  allowChange?: boolean
}

export async function createPoll(
  page: Page,
  { question, options, allowChange = false }: PollInput
) {
  await page.getByRole('link', { name: 'Create a poll' }).click()
  await page.getByLabel('Question', { exact: true }).fill(question)
  for (const [index, option] of options.entries()) {
    if (index >= 2) await page.getByRole('button', { name: 'Add option' }).click()
    await page.getByLabel(`Option ${index + 1}`, { exact: true }).fill(option)
  }
  await page
    .getByRole('checkbox', { name: 'Allow voters to change their vote' })
    .setChecked(allowChange)
  await page.getByRole('button', { name: 'Create poll', exact: true }).click()
  await expect(page).toHaveURL(/\/p\/[^/?#]+$/)
  await expect(page.getByRole('heading', { name: question, exact: true })).toBeVisible()
  return page.url()
}

export async function closePoll(page: Page, question: string) {
  await page.getByRole('link', { name: 'Dashboard' }).click()
  const row = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: question, exact: true }),
  })
  await row.getByRole('button', { name: 'Close poll' }).click()
  await expect(row.getByText('Closed', { exact: true })).toBeVisible()
}

export async function vote(page: Page, option: string) {
  const group = page.getByRole('group', { name: 'Pick one option' })
  await group.getByRole('radio', { name: option, exact: true }).check()
  await page.getByRole('button', { name: 'Vote', exact: true }).click()
}

export const test = base.extend<{ creator: Page }>({
  creator: async ({ browser, baseURL }, runTest) => {
    const context = await browser.newContext({ baseURL })
    try {
      const creator = await context.newPage()
      await registerCreator(creator)
      await runTest(creator)
    } finally {
      await context.close()
    }
  },
})
