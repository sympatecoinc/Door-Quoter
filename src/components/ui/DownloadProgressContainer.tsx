'use client'

import { useDownloadStore } from '@/stores/downloadStore'
import { DownloadProgressToast } from './DownloadProgressToast'

export function DownloadProgressContainer() {
  const downloads = useDownloadStore((state) => state.downloads)
  const dismissDownload = useDownloadStore((state) => state.dismissDownload)

  if (downloads.length === 0) {
    return null
  }

  return (
    <>
      {downloads.map((download, index) => (
        <DownloadProgressToast
          key={download.id}
          download={download}
          index={index}
          onDismiss={() => dismissDownload(download.id)}
        />
      ))}
    </>
  )
}
