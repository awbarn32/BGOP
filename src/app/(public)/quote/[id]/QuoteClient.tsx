'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

interface QuoteJob {
  id: string
  status: string
  customer: {
    id: string
    full_name: string
  }
}

export function QuoteClient({ job }: { job: QuoteJob }) {
  const router = useRouter()
  const [authorizing, setAuthorizing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isQuoteSent = job.status === 'quote_sent' || job.status === 'awaiting_customer'
  const isConfirmed = [
    'confirmed', 'awaiting_drop_off', 'driver_assigned', 'picked_up', 'in_transit', 'received_at_shop',
    'awaiting_assignment', 'awaiting_parts', 'awaiting_approval', 'work_started', 'paused_parts', 'paused_approval',
    'work_completed', 'awaiting_pickup', 'driver_assigned_delivery', 'out_for_delivery', 'returned_to_customer', 'archived'
  ].includes(job.status)

  // Determine if it was rejected
  const isRejected = job.status === 'rejected' || job.status === 'withdrawn'

  async function handleAuthorize() {
    setAuthorizing(true)
    setError(null)
    try {
      const res = await fetch(`/api/quotes/${job.id}/authorize`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error((json.error as { message?: string })?.message || 'Failed to authorize quote')
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setAuthorizing(false)
    }
  }

  if (isConfirmed) {
    return (
      <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-2xl p-6 text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-900/40 text-emerald-400 mb-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-emerald-300">Quote Authorized</h3>
        <p className="text-sm text-emerald-400/80">Thank you! This quote has been approved and confirmed. The Butler Garage team will proceed with the services.</p>
      </div>
    )
  }

  if (isRejected) {
    return (
      <div className="bg-red-900/20 border border-red-800/40 rounded-2xl p-6 text-center space-y-3">
        <h3 className="text-xl font-semibold text-red-300">Quote Declined</h3>
        <p className="text-sm text-red-400/80">This quote is no longer active.</p>
      </div>
    )
  }

  if (isQuoteSent) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-white">Review & Authorize</h3>
          <p className="text-sm text-gray-400">By approving this quote, you authorize Butler Garage to perform the listed services.</p>
        </div>
        
        {error && (
          <div className="p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300 text-center">
            {error}
          </div>
        )}

        <Button
          variant="primary"
          className="w-full justify-center py-4 text-base font-semibold"
          loading={authorizing}
          onClick={handleAuthorize}
        >
          {authorizing ? 'Authorizing...' : 'Approve & Authorize Services'}
        </Button>
      </div>
    )
  }

  // Fallback for new jobs that haven't been formally quoted yet
  return (
    <div className="bg-gray-800/40 border border-gray-800 rounded-2xl p-6 text-center space-y-3">
      <h3 className="text-lg font-semibold text-gray-300">Quote In Progress</h3>
      <p className="text-sm text-gray-500">The team is currently reviewing this request.</p>
    </div>
  )
}
