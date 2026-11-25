/**
 * Validation limits shared by the API (VineJS) and the web app (zod).
 * Changing a number here changes it everywhere.
 */
export const LIMITS = {
  questionMin: 3,
  questionMax: 200,
  optionsMin: 2,
  optionsMax: 8,
  optionLabelMin: 1,
  optionLabelMax: 100,
  passwordMin: 8,
  passwordMax: 128,
  emailMax: 254,
  slugLength: 8,
} as const

/** Slugs are 8 URL-safe base64 characters (6 random bytes). */
export const SLUG_PATTERN = /^[A-Za-z0-9_-]{8}$/
