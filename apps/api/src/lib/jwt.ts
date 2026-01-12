import { SignJWT, jwtVerify } from 'jose'
import { config } from '@/config'

const secret = new TextEncoder().encode(config.jwt.secret)

export interface UserPayload {
  userId: number
  email: string
  name: string | null
  tenantId: number
  isAdmin: boolean
  isTenantAdmin: boolean
}

// Payload for users who authenticated with Google but don't have an account yet
export interface PendingUserPayload {
  type: 'pending'
  email: string
  name: string
  picture: string | null
}

export async function generateJWT(payload: UserPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.jwt.expiresIn)
    .sign(secret)
}

export async function generatePendingJWT(payload: Omit<PendingUserPayload, 'type'>): Promise<string> {
  return new SignJWT({ ...payload, type: 'pending' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h') // Short expiration for pending tokens
    .sign(secret)
}

export async function verifyJWT(token: string): Promise<UserPayload> {
  const { payload } = await jwtVerify(token, secret)

  return {
    userId: payload.userId as number,
    email: payload.email as string,
    name: (payload.name as string | null) ?? null,
    tenantId: payload.tenantId as number,
    isAdmin: payload.isAdmin as boolean,
    isTenantAdmin: payload.isTenantAdmin as boolean,
  }
}

export async function verifyPendingJWT(token: string): Promise<PendingUserPayload> {
  const { payload } = await jwtVerify(token, secret)

  if (payload.type !== 'pending') {
    throw new Error('Invalid pending token')
  }

  return {
    type: 'pending',
    email: payload.email as string,
    name: payload.name as string,
    picture: (payload.picture as string | null) ?? null,
  }
}
