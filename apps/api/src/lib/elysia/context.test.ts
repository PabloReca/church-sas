import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import Elysia from 'elysia'
import { getDb } from '@/db/connection'
import { verifyJWT } from '@/lib/auth/jwt'

vi.mock('@/db/connection', () => ({
  getDb: vi.fn(),
}))

vi.mock('@/lib/auth/jwt', () => ({
  verifyJWT: vi.fn(),
}))

const mockedGetDb = vi.mocked(getDb)
const mockedVerifyJWT = vi.mocked(verifyJWT)

describe('contextPlugin', () => {
  let contextPlugin: Awaited<typeof import('./context')>['contextPlugin']

  beforeAll(async () => {
    const module = await import('./context')
    contextPlugin = module.contextPlugin
  })

  beforeEach(() => {
    mockedGetDb.mockReturnValue({ marker: 'db' } as unknown as ReturnType<typeof getDb>)
    mockedVerifyJWT.mockReset()
  })

  test('returns null user when no auth cookie is present', async () => {
    const app = new Elysia()
      .use(contextPlugin)
      .get('/ctx', ({ user, db }) => ({ hasUser: !!user, hasDb: !!db }))

    const response = await app.handle(new Request('http://localhost/ctx'))
    const data = await response.json() as { hasUser: boolean; hasDb: boolean }

    expect(data).toEqual({ hasUser: false, hasDb: true })
    expect(mockedVerifyJWT).not.toHaveBeenCalled()
  })

  test('returns user when auth cookie is valid', async () => {
    mockedVerifyJWT.mockResolvedValue({
      userId: "550e8400-e29b-41d4-a716-446655440001",
      email: 'user@example.com',
      name: 'User',
      tenantId: "550e8400-e29b-41d4-a716-446655440001",
      isAdmin: false,
      isTenantAdmin: false,
    })

    const app = new Elysia()
      .use(contextPlugin)
      .get('/ctx', ({ user }) => ({ user }))

    const response = await app.handle(
      new Request('http://localhost/ctx', {
        headers: {
          cookie: 'auth_token=valid',
        },
      })
    )
    const data = await response.json() as { user: { email: string } }

    expect(data.user.email).toBe('user@example.com')
    expect(mockedVerifyJWT).toHaveBeenCalledWith('valid')
  })

  test('invalid token leaves user null', async () => {
    mockedVerifyJWT.mockRejectedValue(new Error('invalid token'))

    const app = new Elysia()
      .use(contextPlugin)
      .get('/ctx', ({ user }) => ({ hasUser: !!user }))

    const response = await app.handle(
      new Request('http://localhost/ctx', {
        headers: {
          cookie: 'auth_token=invalid',
        },
      })
    )
    const data = await response.json() as { hasUser: boolean }

    expect(data).toEqual({ hasUser: false })
  })
})
