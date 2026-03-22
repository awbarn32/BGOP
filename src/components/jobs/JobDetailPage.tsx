'use client'

import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { JobDrawer } from '@/components/jobs/JobDrawer'

interface JobDetailPageProps {
  jobId: string
}

export function JobDetailPage({ jobId }: JobDetailPageProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header
        title="Job Detail"
        actions={(
          <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/board' }}>
            ← Back to Board
          </Button>
        )}
      />

      <div className="flex-1 min-h-0 p-4">
        <JobDrawer
          jobId={jobId}
          onClose={() => { window.location.href = '/board' }}
        />
      </div>
    </div>
  )
}
