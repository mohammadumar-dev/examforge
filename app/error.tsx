'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    if (error.message?.includes('Failed to find Server Action')) {
      window.location.reload()
    }
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-xl font-semibold text-gray-800">Something went wrong</h2>
      <p className="text-sm text-gray-500">
        The page encountered an error. Try reloading — if the problem persists, contact support.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => unstable_retry()}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Reload page
        </button>
      </div>
    </div>
  )
}
