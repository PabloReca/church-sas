import { describe, expect, test, beforeAll, afterAll } from 'vitest'
import { authRoutes } from '@/routes/auth'
import { createAccessFixture, type AccessFixture } from '../../tests/fixtures/access'
import { readJson } from '../../tests/http'

describe('auth routes', () => {
  let fixture: AccessFixture

  beforeAll(async () => {
    fixture = await createAccessFixture('auth-routes')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('GET /auth/google redirects to Google OAuth', async () => {
    const response = await authRoutes.handle(
      new Request('http://localhost/auth/google')
    )
    expect(response.status).toBe(302)
    const location = response.headers.get('Location')
    expect(location).toContain('accounts.google.com')
  })

  test('GET /auth/session returns null when no token', async () => {
    const response = await authRoutes.handle(
      new Request('http://localhost/auth/session')
    )
    expect(response.status).toBe(200)
    const data = await readJson<{ session: null }>(response)
    expect(data.session).toBeNull()
  })

  test('GET /auth/session returns user when valid token', async () => {
    const response = await authRoutes.handle(
      new Request('http://localhost/auth/session', {
        headers: { cookie: `auth_token=${fixture.ownerToken}` },
      })
    )
    expect(response.status).toBe(200)
    const data = await readJson<{ session: { user: { tenantId: number } } }>(response)
    expect(data.session).toBeDefined()
    expect(data.session.user.tenantId).toBe(fixture.tenantId)
  })

  test('POST /auth/logout returns success', async () => {
    const response = await authRoutes.handle(
      new Request('http://localhost/auth/logout', {
        method: 'POST',
        headers: { cookie: `auth_token=${fixture.ownerToken}` },
      })
    )
    expect(response.status).toBe(200)
    const data = await readJson<{ success: boolean }>(response)
    expect(data.success).toBe(true)
  })

  test('GET /auth/pending returns null when no token', async () => {
    const response = await authRoutes.handle(
      new Request('http://localhost/auth/pending')
    )
    expect(response.status).toBe(200)
    const data = await readJson<{ pending: null }>(response)
    expect(data.pending).toBeNull()
  })

  test('POST /auth/pending/cancel returns success', async () => {
    const response = await authRoutes.handle(
      new Request('http://localhost/auth/pending/cancel', {
        method: 'POST',
      })
    )
    expect(response.status).toBe(200)
    const data = await readJson<{ success: boolean }>(response)
    expect(data.success).toBe(true)
  })

  test('POST /auth/create-tenant creates a new tenant', async () => {
    const uniqueEmail = `create-tenant-${Date.now()}@test.com`
    const response = await authRoutes.handle(
      new Request('http://localhost/auth/create-tenant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantName: 'Test Church',
          ownerEmail: uniqueEmail,
        }),
      })
    )
    expect(response.status).toBe(200)
    const data = await readJson<{ tenant: { id: number; name: string } }>(response)
    expect(data.tenant).toBeDefined()
    expect(data.tenant.name).toBe('Test Church')
  })

  test('POST /auth/create-tenant validates input', async () => {
    const response = await authRoutes.handle(
      new Request('http://localhost/auth/create-tenant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantName: '',
          ownerEmail: 'not-an-email',
        }),
      })
    )
    expect(response.status).toBe(422)
  })
})
