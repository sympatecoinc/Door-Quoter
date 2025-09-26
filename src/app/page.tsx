import Sidebar from '@/components/Sidebar'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <Dashboard />
        </div>
      </main>
    </div>
  )
}
