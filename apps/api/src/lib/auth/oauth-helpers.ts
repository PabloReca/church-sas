import type { Context } from 'elysia'
import { config } from '@/config'

export async function exchangeGoogleCode(code: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.callbackUrl,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    throw new Error('Token exchange failed')
  }

  return response.json() as Promise<{ id_token: string }>
}

export function redirect(set: Context['set'], url: string) {
  set.status = 302
  set.headers['Location'] = url
  return ''
}
