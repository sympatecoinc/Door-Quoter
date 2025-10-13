'use client'

import { AlertCircle } from 'lucide-react'

export default function PricingRulesTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Pricing Rules</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage detailed pricing rules for parts and materials
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-blue-900 mb-1">
              Pricing Rules Management
            </h3>
            <p className="text-sm text-blue-800 mb-3">
              Pricing rules are currently managed in the <strong>Master Parts</strong> view.
              Each master part can have associated pricing rules and stock length rules for extrusions.
            </p>
            <p className="text-sm text-blue-800">
              To manage pricing rules:
            </p>
            <ol className="list-decimal list-inside text-sm text-blue-800 mt-2 space-y-1 ml-2">
              <li>Navigate to the <strong>Master Parts</strong> tab in the sidebar</li>
              <li>Select a master part to view its details</li>
              <li>Use the <strong>Pricing Rules</strong> or <strong>Stock Length Rules</strong> sections to add/edit rules</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Future Enhancement Placeholder */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-2">
          Future Enhancement
        </h3>
        <p className="text-sm text-gray-600">
          In a future update, this tab will provide a consolidated view of all pricing rules across
          all parts, with advanced filtering and bulk editing capabilities. It will also allow
          associating specific pricing rules with pricing modes for more granular control.
        </p>
      </div>
    </div>
  )
}
