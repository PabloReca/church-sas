import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Context } from 'elysia'
import { config } from '@/config'
import { exchangeGoogleCode, redirect } from '@/lib/auth/oauth-helpers'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('oauth-helpers', () => {
  test('exchangeGoogleCode posts to Google token endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id_token: 'token' }),
    })
    vi.stubGlobal('fetch', fetchMock as typeof fetch)

    await exchangeGoogleCode('test-code')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' })

    const params = init.body as URLSearchParams
    expect(params.get('code')).toBe('test-code')
    expect(params.get('client_id')).toBe(config.google.clientId)
    expect(params.get('client_secret')).toBe(config.google.clientSecret)
    expect(params.get('redirect_uri')).toBe(config.google.callbackUrl)
    expect(params.get('grant_type')).toBe('authorization_code')
  })

  test('exchangeGoogleCode throws on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchMock as typeof fetch)

    await expect(exchangeGoogleCode('bad-code')).rejects.toThrow('Token exchange failed')
  })

  test('redirect sets status and location header', () => {
    const set = {
      status: 200,
      headers: {},
    } as Context['set']

    const result = redirect(set, 'https://example.com')

    expect(set.status).toBe(302)
    expect(set.headers.Location).toBe('https://example.com')
    expect(result).toBe('')
  })
})
