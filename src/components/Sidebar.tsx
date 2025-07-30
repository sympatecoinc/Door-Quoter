'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { MenuOption } from '@/types'
import { 
  Home, 
  Folder, 
  Package, 
  Database,
  Settings,
  Plus,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

const menuItems = [
  { id: 'dashboard' as MenuOption, label: 'Dashboard', icon: Home },
  { id: 'projects' as MenuOption, label: 'Projects', icon: Folder },
  { id: 'products' as MenuOption, label: 'Build Products', icon: Package },
  { id: 'masterParts' as MenuOption, label: 'Master Parts', icon: Database },
  { id: 'settings' as MenuOption, label: 'Settings', icon: Settings },
]

interface Project {
  id: number
  name: string
  status: string
}

export default function Sidebar() {
  const { currentMenu, setCurrentMenu, selectedProjectId, setSelectedProjectId } = useAppStore()
  const [showProjects, setShowProjects] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    if (showProjects) {
      fetchProjects()
    }
  }, [showProjects])

  async function fetchProjects() {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const projectsData = await response.json()
        setProjects(projectsData)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  return (
    <div className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Quoting Tool</h1>
        <p className="text-sm text-gray-600 mt-1">Aluminum Doors & Windows</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = currentMenu === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentMenu(item.id)}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Project Selector */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => setShowProjects(!showProjects)}
          className="w-full flex items-center justify-between px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
        >
          <span className="font-medium">Projects</span>
          {showProjects ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        
        {showProjects && (
          <div className="mt-2 space-y-1">
            <button 
              onClick={() => setCurrentMenu('projects')}
              className="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Project
            </button>
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setSelectedProjectId(project.id)
                  setCurrentMenu('projects')
                }}
                className={`w-full flex items-center px-3 py-2 text-sm rounded-lg text-left ${
                  selectedProjectId === project.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex-1 truncate">
                  {project.name}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  project.status === 'Draft' 
                    ? 'bg-gray-100 text-gray-600'
                    : project.status === 'In Progress'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-green-100 text-green-600'
                }`}>
                  {project.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}