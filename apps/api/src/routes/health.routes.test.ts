import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { healthRoutes } from '@/routes/health'
import { createTenantFixture, type TenantFixture } from '../../tests/fixtures/tenant'
import { readJson } from '../../tests/http'

describe('health routes', () => {
  let fixture: TenantFixture

  beforeAll(async () => {
    fixture = await createTenantFixture('health')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('returns ok and ready', async () => {
    const healthResponse = await healthRoutes.handle(
      new Request('http://localhost/health')
    )
    expect(healthResponse.status).toBe(200)
    const healthData = await readJson<{ status: string }>(healthResponse)
    expect(healthData.status).toBe('ok')

    const checkResponse = await healthRoutes.handle(
      new Request('http://localhost/health/check')
    )
    expect(checkResponse.status).toBe(200)
    const checkData = await readJson<{ ok: boolean }>(checkResponse)
    expect(checkData.ok).toBe(true)

    const readyResponse = await healthRoutes.handle(
      new Request('http://localhost/health/ready')
    )
    expect(readyResponse.status).toBe(200)
    const readyData = await readJson<{ ready: boolean }>(readyResponse)
    expect(readyData.ready).toBe(true)
  })
})
