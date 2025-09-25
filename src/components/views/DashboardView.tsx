'use client'

import { useState, useEffect } from 'react'
import { Folder, DollarSign, LayoutGrid } from 'lucide-react'

interface DashboardStats {
  totalProjects: number
  totalValue: number
  totalOpenings: number
}

interface RecentProject {
  id: number
  name: string
  status: string
  openingsCount: number
  value: number
  updatedAt: string
}

interface DashboardData {
  stats: DashboardStats
  recentProjects: RecentProject[]
}

export default function DashboardView() {
  const [data, setData] = useState<DashboardData>({
    stats: {
      totalProjects: 0,
      totalValue: 0,
      totalOpenings: 0
    },
    recentProjects: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await fetch('/api/dashboard')
        if (response.ok) {
          const dashboardData = await response.json()
          setData(dashboardData)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  return (
    <div className="p-8">
      {/* TEST BANNER - VISIBLE ROLLBACK TEST */}
      <div className="mb-6 p-4 bg-yellow-400 border-2 border-yellow-500 rounded-lg">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-yellow-900">🧪 TEST MODE ACTIVE</h2>
            <p className="text-yellow-800 mt-1">This is a temporary banner for git rollback testing</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of your quoting projects</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Folder className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900">{data.stats.totalProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ${data.stats.totalValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <LayoutGrid className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Openings</p>
              <p className="text-2xl font-bold text-gray-900">{data.stats.totalOpenings}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Projects</h2>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : data.recentProjects.length > 0 ? (
            <div className="space-y-4">
              {data.recentProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">{project.name}</h3>
                    <p className="text-sm text-gray-600">
                      {project.status} • {project.openingsCount} opening{project.openingsCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${project.value.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">
                      Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No projects found. Create your first project to get started!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}