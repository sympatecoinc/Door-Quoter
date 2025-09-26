import Sidebar from '@/components/Sidebar'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-orange-100 px-4 py-2 text-orange-800 text-sm border-b border-orange-200">
          🚀 ORANGE BANNER - Rollback Practice v3.0
        </div>
        <div className="flex-1 overflow-hidden">
          <Dashboard />
        </div>
      </main>
    </div>
  )
}
