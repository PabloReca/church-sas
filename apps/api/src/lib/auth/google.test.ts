import { beforeEach, describe, expect, test, vi } from 'vitest'
import { verifyGoogleToken } from '@/lib/auth/google'
import { jwtVerify } from 'jose'

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(),
}))

const mockedJwtVerify = vi.mocked(jwtVerify)

beforeEach(() => {
  mockedJwtVerify.mockReset()
})

describe('google', () => {
  test('verifyGoogleToken returns user for valid payload', async () => {
    mockedJwtVerify.mockResolvedValue({
      payload: {
        sub: 'sub',
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.png',
      },
    } as unknown as Awaited<ReturnType<typeof jwtVerify>>)

    const result = await verifyGoogleToken('token')

    expect(result).toEqual({
      sub: 'sub',
      email: 'user@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.png',
    })
  })

  test('verifyGoogleToken returns null when email missing', async () => {
    mockedJwtVerify.mockResolvedValue({
      payload: {
        sub: 'sub',
        name: 'Test User',
      },
    } as unknown as Awaited<ReturnType<typeof jwtVerify>>)

    await expect(verifyGoogleToken('token')).resolves.toBeNull()
  })

  test('verifyGoogleToken returns null on verification error', async () => {
    mockedJwtVerify.mockRejectedValue(new Error('invalid token'))

    await expect(verifyGoogleToken('token')).resolves.toBeNull()
  })
})
