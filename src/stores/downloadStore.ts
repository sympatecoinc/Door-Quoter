import { create } from 'zustand'

export type DownloadStatus = 'processing' | 'complete' | 'error'

export type DownloadType = 'bom' | 'cutlist' | 'shop-drawings' | 'purchase-summary' | 'packing-list' | 'labels' | 'box-list' | 'logistics' | 'pricing-debug'

export interface Download {
  id: string
  name: string
  type: DownloadType
  status: DownloadStatus
  progress?: number // 0-100 for progress percentage
  error?: string
  startedAt: number
}

interface DownloadState {
  downloads: Download[]
  startDownload: (params: { name: string; type: DownloadType }) => string
  updateProgress: (id: string, progress: number) => void
  completeDownload: (id: string) => void
  failDownload: (id: string, error: string) => void
  dismissDownload: (id: string) => void
}

let idCounter = 0

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: [],

  startDownload: ({ name, type }) => {
    const id = `download-${Date.now()}-${++idCounter}`
    const newDownload: Download = {
      id,
      name,
      type,
      status: 'processing',
      startedAt: Date.now()
    }
    set((state) => ({
      downloads: [...state.downloads, newDownload]
    }))
    return id
  },

  updateProgress: (id, progress) => {
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id ? { ...d, progress: Math.min(100, Math.max(0, progress)) } : d
      )
    }))
  },

  completeDownload: (id) => {
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id ? { ...d, status: 'complete' as DownloadStatus, progress: 100 } : d
      )
    }))
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      get().dismissDownload(id)
    }, 5000)
  },

  failDownload: (id, error) => {
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id ? { ...d, status: 'error' as DownloadStatus, error } : d
      )
    }))
  },

  dismissDownload: (id) => {
    set((state) => ({
      downloads: state.downloads.filter((d) => d.id !== id)
    }))
  }
}))
