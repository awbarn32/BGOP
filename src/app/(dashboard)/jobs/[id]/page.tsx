import { JobDetailPage } from '@/components/jobs/JobDetailPage'

interface JobDetailRouteProps {
  params: Promise<{ id: string }>
}

export default async function JobDetailRoute({ params }: JobDetailRouteProps) {
  const { id } = await params

  return <JobDetailPage jobId={id} />
}
