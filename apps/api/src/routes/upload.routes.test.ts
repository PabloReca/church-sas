import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { createAccessFixture, type AccessFixture } from '../../tests/fixtures/access'
import { readJson } from '../../tests/http'
import { createTestApp } from '../../tests/test-app'

vi.mock('sharp', () => {
  const toBuffer = vi.fn().mockResolvedValue(Buffer.from('ok'))
  const webp = vi.fn().mockReturnValue({ toBuffer })
  const resize = vi.fn().mockReturnValue({ webp })
  const sharpMock = vi.fn().mockReturnValue({ resize })

  return { default: sharpMock }
})

vi.mock('@/lib/infra/minio', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://example.com/photo.webp'),
}))

describe('upload routes', () => {
  let fixture: AccessFixture
  let uploadRoutes: Awaited<typeof import('@/routes/upload')>['uploadRoutes']

  beforeAll(async () => {
    fixture = await createAccessFixture('upload')

    const module = await import('@/routes/upload')
    uploadRoutes = module.uploadRoutes
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  const buildFormData = (overrides?: Partial<Record<'type' | 'userId' | 'tenantId', string>>) => {
    const formData = new FormData()
    const blob = new Blob([Buffer.from('test-image')], { type: 'image/png' })
    formData.append('file', blob, 'photo.png')
    formData.append('type', overrides?.type ?? 'tenant')
    formData.append('userId', overrides?.userId ?? String(fixture.ownerPersonId))
    if (overrides?.tenantId !== undefined) {
      formData.append('tenantId', overrides.tenantId)
    } else {
      formData.append('tenantId', String(fixture.tenantId))
    }
    return formData
  }

  test('rejects unauthenticated and forbidden uploads', async () => {
    const app = createTestApp(uploadRoutes)

    const noAuthResponse = await app.handle(
      new Request('http://localhost/upload/photo', {
        method: 'POST',
        body: buildFormData(),
      })
    )
    expect(noAuthResponse.status).toBe(401)

    const masterResponse = await app.handle(
      new Request('http://localhost/upload/photo', {
        method: 'POST',
        headers: {
          cookie: `auth_token=${fixture.ownerToken}`,
        },
        body: buildFormData({ type: 'master' }),
      })
    )
    expect(masterResponse.status).toBe(403)

    const outsiderResponse = await app.handle(
      new Request('http://localhost/upload/photo', {
        method: 'POST',
        headers: {
          cookie: `auth_token=${fixture.outsiderToken}`,
        },
        body: buildFormData({
          type: 'tenant',
          tenantId: String(fixture.tenantId),
        }),
      })
    )
    expect(outsiderResponse.status).toBe(403)

    const missingTenant = await app.handle(
      new Request('http://localhost/upload/photo', {
        method: 'POST',
        headers: {
          cookie: `auth_token=${fixture.ownerToken}`,
        },
        body: buildFormData({ type: 'tenant', tenantId: '' }),
      })
    )
    expect(missingTenant.status).toBe(400)
  })

  test('POST /upload/photo uploads tenant photo', async () => {
    const { uploadFile } = await import('@/lib/infra/minio')
    const mockedUpload = vi.mocked(uploadFile)

    const response = await uploadRoutes.handle(
      new Request('http://localhost/upload/photo', {
        method: 'POST',
        headers: {
          cookie: `auth_token=${fixture.ownerToken}`,
        },
        body: buildFormData(),
      })
    )

    expect(response.status).toBe(200)
    const data = await readJson<{ url: string }>(response)
    expect(data.url).toBe('https://example.com/photo.webp')
    expect(mockedUpload).toHaveBeenCalledWith(
      expect.any(Buffer),
      `tenants/${fixture.tenantId}/users/${fixture.ownerPersonId}/photo.webp`,
      'image/webp'
    )
  })
})
