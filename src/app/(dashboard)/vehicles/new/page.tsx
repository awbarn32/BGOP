'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Header } from '@/components/layout/Header'
import { VehicleForm } from '@/components/vehicles/VehicleForm'
import type { Vehicle } from '@/types/domain'

function NewVehicleContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const customerId = searchParams.get('customer_id') ?? ''

  function onSuccess(vehicle: Vehicle) {
    if (customerId) {
      router.push(`/customers/${customerId}`)
    } else {
      router.push('/vehicles')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Add Vehicle" />
      <div className="p-6 max-w-2xl">
        <VehicleForm
          customerId={customerId}
          onSuccess={onSuccess}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  )
}

export default function NewVehiclePage() {
  return (
    <Suspense>
      <NewVehicleContent />
    </Suspense>
  )
}
