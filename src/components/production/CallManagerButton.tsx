'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'
import CallManagerModal from './CallManagerModal'

interface CallManagerButtonProps {
  stationName: string
  workOrderInfo?: {
    id: string
    projectName: string
    batchNumber: number
  } | null
}

export default function CallManagerButton({
  stationName,
  workOrderInfo
}: CallManagerButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center z-40 transition-all duration-200 hover:scale-105 active:scale-95"
        title="Contact Production Manager"
        aria-label="Contact Production Manager"
      >
        <Bell className="w-6 h-6" />
      </button>

      {/* Modal */}
      <CallManagerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        stationName={stationName}
        workOrderInfo={workOrderInfo}
      />
    </>
  )
}
