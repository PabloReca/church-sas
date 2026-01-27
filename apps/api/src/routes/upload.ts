import Elysia, { t } from 'elysia'
import sharp from 'sharp'
import { uploadFile } from '@/lib/infra/minio'
import { contextPlugin } from '@/lib/elysia/context'
import { authGuard, requireTenantUser } from '@/lib/elysia/guards'
import { isAdmin } from '@/lib/auth/helpers'
import { logger } from '@/lib/infra/logger'
import { badRequest, forbidden, internalError, isHttpError } from '@/lib/http-errors'

// Image processing configuration
const MAX_IMAGE_DIMENSION = 1000
const MAX_OUTPUT_SIZE = 100 * 1024
const WEBP_QUALITY = 80

export const uploadRoutes = new Elysia({ prefix: '/upload', tags: ['Upload'] })
  .use(contextPlugin)
  .use(authGuard)
  .post(
    '/photo',
    async ({ body, user, db }) => {
      try {
        const { file, type, userId, tenantId } = body

        // Users can only upload their own photos (unless admin)
        if (userId !== user.userId && !isAdmin(user)) {
          throw forbidden('Forbidden')
        }

        let filePath: string
        if (type === 'master') {
          // Only admins can upload to master
          if (!isAdmin(user)) {
            throw forbidden('Forbidden')
          }
          filePath = `admins/${userId}/photo.webp`
        } else if (type === 'tenant' && tenantId) {
          await requireTenantUser(db, user, tenantId)
          filePath = `tenants/${tenantId}/users/${userId}/photo.webp`
        } else {
          throw badRequest('Invalid type or missing tenantId')
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
          throw badRequest(
            `Image too complex. Could not compress below ${MAX_OUTPUT_SIZE / 1024}KB`
          )
        }

        const url = await uploadFile(processedBuffer, filePath, 'image/webp')

        return { url }
      } catch (error) {
        if (isHttpError(error)) {
          throw error
        }
        logger.error({ err: error }, 'Error uploading photo')
        throw internalError('Failed to upload photo')
      }
    },
    {
      body: t.Object({
        file: t.File(),
        type: t.String(),
        userId: t.String(),
        tenantId: t.Optional(t.String()),
      }),
    }
  )
