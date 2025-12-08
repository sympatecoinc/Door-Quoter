'use client'

import PricingModesTab from '../accounting/PricingModesTab'

export default function AccountingView() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pricing Modes</h1>
        <p className="text-gray-600 mt-2">Create and manage pricing strategies for projects</p>
      </div>

      {/* Content */}
      <div className="max-w-6xl">
        <PricingModesTab />
      </div>
    </div>
  )
}
