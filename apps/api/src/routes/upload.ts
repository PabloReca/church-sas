import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import sharp from 'sharp'
import { uploadFile } from '@/lib/minio'
import { verifyJWT } from '@/lib/jwt'
import { people, tenantHelpers } from '@/db/schema'
import { getDb } from '@/db/connection'
import { eq, and } from 'drizzle-orm'
import { isAdmin } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

const upload = new Hono()

// Image processing configuration
const MAX_IMAGE_DIMENSION = 1000 // 1000x1000px max
const MAX_OUTPUT_SIZE = 100 * 1024 // 100KB
const WEBP_QUALITY = 80 // Starting quality

upload.post('/photo', async (c) => {
  try {
    // Verify authentication
    const token = getCookie(c, 'auth_token')
    if (!token) {
      return c.json({ error: 'Not authenticated' }, 401)
    }

    let user
    try {
      user = await verifyJWT(token)
    } catch {
      return c.json({ error: 'Invalid token' }, 401)
    }

    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string
    const userId = formData.get('userId') as string
    const tenantId = formData.get('tenantId') as string | null

    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    if (!type || !userId) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const targetUserId = parseInt(userId)

    // Users can only upload their own photos (unless admin)
    if (targetUserId !== user.userId && !isAdmin(user)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    let filePath: string
    if (type === 'master') {
      // Only admins can upload to master
      if (!isAdmin(user)) {
        return c.json({ error: 'Forbidden' }, 403)
      }
      filePath = `admins/${userId}/photo.webp`
    } else if (type === 'tenant' && tenantId) {
      const tenantIdNum = parseInt(tenantId)

      // Verify person has access to this tenant (unless admin)
      if (!isAdmin(user)) {
        const db = getDb()

        // Check if person belongs to this tenant (primary or helper)
        const [person] = await db
          .select()
          .from(people)
          .where(
            and(
              eq(people.id, user.userId),
              eq(people.tenantId, tenantIdNum)
            )
          )
          .limit(1)

        if (!person) {
          // Check if helper
          const [helper] = await db
            .select()
            .from(tenantHelpers)
            .where(
              and(
                eq(tenantHelpers.personId, user.userId),
                eq(tenantHelpers.tenantId, tenantIdNum)
              )
            )
            .limit(1)

          if (!helper) {
            return c.json({ error: 'Forbidden' }, 403)
          }
        }
      }

      filePath = `tenants/${tenantId}/users/${userId}/photo.webp`
    } else {
      return c.json({ error: 'Invalid type or missing tenantId' }, 400)
    }

    // Process image: resize, convert to WebP, compress
    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    let processedBuffer = await sharp(inputBuffer)
      .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()

    // If still over 100KB, reduce quality iteratively
    let quality = WEBP_QUALITY
    while (processedBuffer.length > MAX_OUTPUT_SIZE && quality > 20) {
      quality -= 10
      processedBuffer = await sharp(inputBuffer)
        .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toBuffer()
    }

    // Final check
    if (processedBuffer.length > MAX_OUTPUT_SIZE) {
      return c.json({
        error: `Image too complex. Could not compress below ${MAX_OUTPUT_SIZE / 1024}KB`
      }, 400)
    }

    const url = await uploadFile(processedBuffer, filePath, 'image/webp')

    return c.json({ url })
  } catch (error) {
    logger.error({ err: error }, 'Error uploading photo')
    return c.json({ error: 'Failed to upload photo' }, 500)
  }
})

export default upload
