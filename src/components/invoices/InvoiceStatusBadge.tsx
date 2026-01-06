'use client'

import { InvoiceStatus, INVOICE_STATUS_CONFIG } from '@/types/invoice'

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus
  size?: 'sm' | 'md' | 'lg'
}

export default function InvoiceStatusBadge({ status, size = 'md' }: InvoiceStatusBadgeProps) {
  const config = INVOICE_STATUS_CONFIG[status] || INVOICE_STATUS_CONFIG.DRAFT

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bgColor} ${config.color} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  )
}
