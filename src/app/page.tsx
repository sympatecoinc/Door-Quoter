import Sidebar from '@/components/Sidebar'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-green-100 px-4 py-2 text-green-800 text-sm border-b border-green-200">
          🚀 Practice Banner - Testing Git Push & Rollback v2.0
        </div>
        <div className="flex-1 overflow-hidden">
          <Dashboard />
        </div>
      </main>
    </div>
  )
}
