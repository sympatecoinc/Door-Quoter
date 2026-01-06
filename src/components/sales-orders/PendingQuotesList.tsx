'use client'

import { useState, useEffect } from 'react'
import { FileText, DollarSign, Building2, Plus } from 'lucide-react'

interface PendingQuote {
  id: number
  name: string
  status: string
  customerId: number
  customer: {
    id: number
    companyName: string
    contactName?: string | null
    email?: string | null
    quickbooksId?: string | null
  } | null
  totalValue: number
  openingCount: number
  updatedAt: string
}

interface PendingQuotesListProps {
  onCreateSO: (projectId: number) => void
  refreshKey?: number
}

export default function PendingQuotesList({ onCreateSO, refreshKey }: PendingQuotesListProps) {
  const [pendingQuotes, setPendingQuotes] = useState<PendingQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<number | null>(null)

  useEffect(() => {
    fetchPendingQuotes()
  }, [refreshKey])

  async function fetchPendingQuotes() {
    try {
      setLoading(true)
      const response = await fetch('/api/projects/pending-quotes')
      if (response.ok) {
        const data = await response.json()
        setPendingQuotes(data.pendingQuotes || [])
      }
    } catch (error) {
      console.error('Error fetching pending quotes:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  async function handleCreateSO(projectId: number) {
    setCreating(projectId)
    try {
      // Call the parent handler which will create the SO
      await onCreateSO(projectId)
    } finally {
      setCreating(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        Loading pending quotes...
      </div>
    )
  }

  if (pendingQuotes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Quotes</h3>
        <p className="text-gray-500">
          When a quote is accepted, it will appear here ready to be converted to a sales order.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Accepted Quotes Ready for Sales Orders</h2>
        <p className="text-sm text-gray-500 mt-1">
          These projects have accepted quotes but no sales order created yet
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Project
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Value
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Openings
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Accepted
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pendingQuotes.map(quote => (
              <tr key={quote.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{quote.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {quote.customer?.companyName || 'Unknown Customer'}
                      </div>
                      {quote.customer?.contactName && (
                        <div className="text-xs text-gray-500">{quote.customer.contactName}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-gray-900">{formatCurrency(quote.totalValue)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {quote.openingCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatDate(quote.updatedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleCreateSO(quote.id)}
                    disabled={creating === quote.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {creating === quote.id ? (
                      'Creating...'
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Create SO
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
