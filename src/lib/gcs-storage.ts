import { Storage } from '@google-cloud/storage'

const storage = new Storage()
const bucketName = process.env.GCS_BUCKET_NAME || ''

function getBucket() {
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME environment variable is not set')
  }
  return storage.bucket(bucketName)
}

export async function uploadFile(
  buffer: Buffer,
  destination: string,
  contentType: string
): Promise<string> {
  const bucket = getBucket()
  const file = bucket.file(destination)

  await file.save(buffer, {
    contentType,
    metadata: {
      cacheControl: 'public, max-age=3600'
    }
  })

  // Return the GCS path (not a public URL - we'll serve via API)
  return destination
}

export async function downloadFile(filePath: string): Promise<Buffer> {
  const bucket = getBucket()
  const file = bucket.file(filePath)

  const [contents] = await file.download()
  return contents
}

export async function deleteFile(filePath: string): Promise<void> {
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
}

export async function fileExists(filePath: string): Promise<boolean> {
  const bucket = getBucket()
  const file = bucket.file(filePath)

  const [exists] = await file.exists()
  return exists
}

export async function getFileMetadata(filePath: string): Promise<{ contentType: string; size: number } | null> {
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
}
