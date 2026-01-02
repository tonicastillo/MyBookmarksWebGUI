import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'
import path from 'path'

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

const BUCKET = process.env.AWS_S3_BUCKET!
const S3_BASE_URL = process.env.AWS_S3_BASE_URL!

/**
 * Verifica si una URL ya apunta a nuestro S3
 */
export const isOurS3Url = (url: string): boolean => {
  return url.startsWith(S3_BASE_URL)
}

/**
 * Genera un key único para S3 basado en el bookmark ID y la URL original
 */
const generateS3Key = (bookmarkId: string, originalUrl: string): string => {
  const urlHash = crypto.createHash('md5').update(originalUrl).digest('hex').slice(0, 8)
  const ext = getExtensionFromUrl(originalUrl)
  return `bookmarks/${bookmarkId}/${urlHash}${ext}`
}

/**
 * Extrae la extensión del archivo de una URL
 */
const getExtensionFromUrl = (url: string): string => {
  try {
    const pathname = new URL(url).pathname
    const ext = path.extname(pathname).toLowerCase()
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
      return ext
    }
  } catch {
    // URL inválida
  }
  return '.jpg'
}

/**
 * Descarga una imagen desde una URL
 */
const downloadImage = async (url: string): Promise<{ buffer: Buffer; contentType: string }> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  return { buffer, contentType }
}

/**
 * Sube una imagen a S3
 */
const uploadToS3 = async (
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> => {
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'max-age=31536000'
  }))

  return `${S3_BASE_URL}/${key}`
}

/**
 * Verifica si un archivo ya existe en S3
 */
const existsInS3 = async (key: string): Promise<boolean> => {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key
    }))
    return true
  } catch (error: unknown) {
    const err = error as { name?: string }
    if (err.name === 'NotFound') {
      return false
    }
    throw error
  }
}

/**
 * Sincroniza una imagen: descarga de origen y sube a nuestro S3
 * Retorna la nueva URL de S3 o null si falla
 */
export const syncImageToS3 = async (
  bookmarkId: string,
  sourceUrl: string
): Promise<string | null> => {
  if (isOurS3Url(sourceUrl)) {
    return sourceUrl
  }

  const s3Key = generateS3Key(bookmarkId, sourceUrl)

  try {
    // Verificar si ya existe en S3 (evitar re-uploads)
    if (await existsInS3(s3Key)) {
      return `${S3_BASE_URL}/${s3Key}`
    }

    const { buffer, contentType } = await downloadImage(sourceUrl)
    const newUrl = await uploadToS3(s3Key, buffer, contentType)

    console.log(`[S3] Synced image for bookmark ${bookmarkId}: ${sourceUrl.slice(0, 50)}... -> ${newUrl}`)

    return newUrl
  } catch (error) {
    console.error(`[S3] Failed to sync image for bookmark ${bookmarkId}:`, error)
    return null
  }
}
