import { expect, test } from '@playwright/test'

test('an anonymous dashboard visit redirects to the login page', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible()
})
