import { useState } from 'react'
import { secondaryButton } from './ui'

export function CopyLinkButton({ slug }: { slug: string }) {
  const [message, setMessage] = useState('')

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/p/${slug}`)
      setMessage('Copied')
    } catch {
      // The Clipboard API is missing on insecure origins or can be denied.
      setMessage('Could not copy')
    }
    setTimeout(() => setMessage(''), 2000)
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className={secondaryButton} onClick={copy}>
        Copy link
      </button>
      <span role="status" className="text-sm text-slate-700">
        {message}
      </span>
    </span>
  )
}
