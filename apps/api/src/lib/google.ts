import { createRemoteJWKSet, jwtVerify } from 'jose'
import { config } from '@/config'

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
)

export interface GoogleUser {
  sub: string
  email: string
  name: string
  picture?: string
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleUser | null> {
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: config.google.clientId,
    })

    if (!payload.email || typeof payload.email !== 'string') {
      return null
    }

    return {
      sub: payload.sub as string,
      email: payload.email,
      name: (payload.name as string) ?? '',
      picture: payload.picture as string | undefined,
    }
  } catch (error) {
    console.error('Error verifying Google token:', error)
    return null
  }
}
