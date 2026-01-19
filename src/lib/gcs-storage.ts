import { Storage } from '@google-cloud/storage'
import * as fs from 'fs/promises'
import * as path from 'path'

const bucketName = process.env.GCS_BUCKET_NAME || ''
const useGCS = !!bucketName
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads')

// Only initialize GCS storage if bucket name is configured
const storage = useGCS ? new Storage() : null

function getBucket() {
  if (!useGCS || !storage) {
    throw new Error('GCS_BUCKET_NAME environment variable is not set')
  }
  return storage.bucket(bucketName)
}

// Helper to get content type from file extension
function getContentTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

export async function uploadFile(
  buffer: Buffer,
  destination: string,
  contentType: string
): Promise<string> {
  if (useGCS) {
    const bucket = getBucket()
    const file = bucket.file(destination)

    await file.save(buffer, {
      contentType,
      metadata: {
        cacheControl: 'public, max-age=3600'
      }
    })
  } else {
    // Filesystem fallback for local development
    const localPath = path.join(LOCAL_UPLOAD_DIR, destination)
    await fs.mkdir(path.dirname(localPath), { recursive: true })
    await fs.writeFile(localPath, buffer)
  }

  // Return the path (not a public URL - we'll serve via API)
  return destination
}

export async function downloadFile(filePath: string): Promise<Buffer> {
  if (useGCS) {
    const bucket = getBucket()
    const file = bucket.file(filePath)

    const [contents] = await file.download()
    return contents
  } else {
    // Filesystem fallback for local development
    const localPath = path.join(LOCAL_UPLOAD_DIR, filePath)
    return await fs.readFile(localPath)
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  if (useGCS) {
    const bucket = getBucket()
    const file = bucket.file(filePath)

    try {
      await file.delete()
    } catch (error: unknown) {
      // Ignore 404 errors (file already deleted)
      if (error && typeof error === 'object' && 'code' in error && error.code !== 404) {
        throw error
      }
    }
  } else {
    // Filesystem fallback for local development
    const localPath = path.join(LOCAL_UPLOAD_DIR, filePath)
    try {
      await fs.unlink(localPath)
    } catch (error: unknown) {
      // Ignore ENOENT errors (file already deleted)
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        throw error
      }
    }
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  if (useGCS) {
    const bucket = getBucket()
    const file = bucket.file(filePath)

    const [exists] = await file.exists()
    return exists
  } else {
    // Filesystem fallback for local development
    const localPath = path.join(LOCAL_UPLOAD_DIR, filePath)
    try {
      await fs.access(localPath)
      return true
    } catch {
      return false
    }
  }
}

export async function getFileMetadata(filePath: string): Promise<{ contentType: string; size: number } | null> {
  if (useGCS) {
    const bucket = getBucket()
    const file = bucket.file(filePath)

    try {
      const [metadata] = await file.getMetadata()
      return {
        contentType: metadata.contentType || 'application/octet-stream',
        size: parseInt(metadata.size as string, 10) || 0
      }
    } catch {
      return null
    }
  } else {
    // Filesystem fallback for local development
    const localPath = path.join(LOCAL_UPLOAD_DIR, filePath)
    try {
      const stats = await fs.stat(localPath)
      return {
        contentType: getContentTypeFromPath(filePath),
        size: stats.size
      }
    } catch {
      return null
    }
  }
}
