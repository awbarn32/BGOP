import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { QuoteClient } from '@/app/(public)/quote/[id]/QuoteClient'

export const dynamic = 'force-dynamic' // Ensure page is rendered fresh for live status

interface Params {
  params: Promise<{ id: string }>
}

const DETAIL_SELECT = `
  id, status, description,
  customer:customers(id, full_name, phone, preferred_language),
  vehicle:vehicles(id, make, model, year, license_plate),
  line_items:job_line_items(
    id, line_type, description, quantity, sale_price, is_scope_change
  ),
  invoice:invoices(id, invoice_number, status, total_amount, deposit_amount)
`

interface QuoteJob {
  id: string
  status: string
  description: string
  customer: {
    id: string
    full_name: string
    phone: string | null
    preferred_language: 'th' | 'en'
  }
  vehicle: {
    id: string
    make: string
    model: string
    year: number
    license_plate: string | null
  }
  line_items: Array<{
    id: string
    line_type: 'labour' | 'part'
    description: string
    quantity: number
    sale_price: number
    is_scope_change: boolean
  }>
  invoice: Array<{
    id: string
    invoice_number: string
    status: string
    total_amount: number
    deposit_amount: number
  }>
}

export default async function QuotePage({ params }: Params) {
  const { id } = await params

  // We use the admin client because this is a public page accessed via secure link
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('jobs')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .single()

  if (error || !data) {
    return notFound()
  }

  const job = data as unknown as QuoteJob

  // Calculate totals
  const subtotal = job.line_items?.reduce((sum, item) => sum + (item.quantity * item.sale_price), 0) ?? 0

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-900/40 text-indigo-400 mb-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Service Estimate</h1>
          <p className="text-gray-400">Butler Garage | Bangkok</p>
        </div>

        {/* Customer & Vehicle Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4 bg-opacity-60 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Customer</p>
              <p className="text-base text-gray-200 font-medium">{job.customer?.full_name}</p>
              {job.customer?.phone && <p className="text-sm text-gray-400 mt-0.5">{job.customer.phone}</p>}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Vehicle</p>
              <p className="text-base text-gray-200 font-medium">
                {job.vehicle?.year} {job.vehicle?.make} {job.vehicle?.model}
              </p>
              {job.vehicle?.license_plate && (
                <p className="text-sm text-gray-400 mt-0.5">{job.vehicle.license_plate}</p>
              )}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-800/30">
            <h2 className="text-lg font-semibold text-white">Proposed Services</h2>
          </div>
          <div className="divide-y divide-gray-800/60">
            {job.line_items?.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No services specified yet.
              </div>
            ) : (
              job.line_items?.map((item) => (
                <div key={item.id} className="px-6 py-4 flex items-start justify-between group hover:bg-gray-800/20 transition-colors">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        item.line_type === 'labour' ? 'bg-blue-900/40 text-blue-400' : 'bg-amber-900/40 text-amber-400'
                      }`}>
                        {item.line_type}
                      </span>
                      {item.is_scope_change && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-orange-900/40 text-orange-400">
                          Add-on
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-200">
                      {item.description.includes(' / ') ? item.description.split(' / ')[0] : item.description}
                    </p>
                    {item.quantity !== 1 && (
                      <p className="text-xs text-gray-500 mt-1">Qty: {item.quantity}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">฿{(item.sale_price * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Totals Section */}
          <div className="px-6 py-5 bg-gray-800/40 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-gray-400">Total Estimate</span>
              <span className="text-xl font-bold text-white">฿{subtotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Interactive Client Component for Authorization */}
        <QuoteClient job={job} />
        
      </div>
    </div>
  )
}
