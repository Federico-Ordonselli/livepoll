/** Shared Tailwind class strings, so buttons and inputs look the same everywhere. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2'

export const primaryButton = `inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`

export const secondaryButton = `inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`

export const textInput = `block w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-500 aria-invalid:border-red-700 ${focusRing}`

export const link = `font-medium text-indigo-700 underline-offset-2 hover:underline rounded-sm ${focusRing}`
