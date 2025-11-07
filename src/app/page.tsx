'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Validate session on page load
    const validateSession = async () => {
      try {
        const response = await fetch('/api/auth/session')
        if (!response.ok) {
          // Session invalid, redirect to login
          router.push('/login')
        }
      } catch (error) {
        console.error('Session validation error:', error)
        router.push('/login')
      }
    }

    validateSession()
  }, [router])

  return (
    <div className="flex h-full bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <Dashboard />
        </div>
      </main>
    </div>
  )
}
