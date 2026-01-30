import React from 'react'

interface DrillBitProps {
  className?: string
}

export default function DrillBit({ className = 'w-6 h-6' }: DrillBitProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Drill bit shaft */}
      <line x1="12" y1="2" x2="12" y2="22" />
      {/* Spiral flutes */}
      <path d="M8 6 L12 8 L16 6" />
      <path d="M8 10 L12 12 L16 10" />
      <path d="M8 14 L12 16 L16 14" />
      {/* Tip */}
      <path d="M10 20 L12 22 L14 20" />
      {/* Shank */}
      <rect x="10" y="2" width="4" height="3" rx="0.5" />
    </svg>
  )
}
