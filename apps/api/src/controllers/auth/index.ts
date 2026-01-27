import { eq } from 'drizzle-orm'
import {
  emails,
  people,
  tenantUsers,
  tenants,
  tenantPlans,
  tenantPeopleFields,
  tenantPeopleFieldValues,
} from '@/db/schema'
import type { Database, DatabaseTransaction } from '@/db/connection'
import { exchangeGoogleCode } from '@/lib/auth/oauth-helpers'
import { verifyGoogleToken } from '@/lib/auth/google'
import { generateJWT, verifyJWT, verifyPendingJWT, type PendingUserPayload } from '@/lib/auth/jwt'
import { config } from '@/config'
import { logger } from '@/lib/infra/logger'
import { badRequest, conflict, internalError, isHttpError, unauthorized } from '@/lib/http-errors'
import { setupTenantInput } from '@church/shared'

export type GoogleCallbackResult = {
  redirectUrl: string
  token?: string
}

export type SessionResponse = {
  session: null | {
    user: {
      userId: string
      email: string
      name: string | null
      tenantId: string
      isAdmin: boolean
      isTenantAdmin: boolean
    }
  }
}

export type PendingResponse = {
  pending: null | {
    email: string
    name: string
    picture: string | null
  }
}

export const getGoogleAuthUrl = () => {
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleAuthUrl.searchParams.set('client_id', config.google.clientId)
  googleAuthUrl.searchParams.set('redirect_uri', config.google.callbackUrl)
  googleAuthUrl.searchParams.set('response_type', 'code')
  googleAuthUrl.searchParams.set('scope', 'openid email profile')
  googleAuthUrl.searchParams.set('access_type', 'offline')
  googleAuthUrl.searchParams.set('prompt', 'consent')

  return googleAuthUrl.toString()
}

export const processGoogleCallback = async (
  db: Database,
  code: string
): Promise<GoogleCallbackResult> => {
  try {
    const { id_token } = await exchangeGoogleCode(code)
    const googleUser = await verifyGoogleToken(id_token)
    if (!googleUser) {
      return { redirectUrl: `${config.frontend.url}/login?error=invalid_token` }
    }

    const normalizedEmail = googleUser.email.toLowerCase()

    const [emailRecord] = await db
      .select()
      .from(emails)
      .where(eq(emails.email, normalizedEmail))
      .limit(1)

    if (!emailRecord) {
      return { redirectUrl: `${config.frontend.url}/login?error=account_not_registered` }
    }

    const [personResult] = await db
      .select({ person: people })
      .from(people)
      .innerJoin(tenantUsers, eq(people.id, tenantUsers.personId))
      .where(eq(people.emailId, emailRecord.id))
      .limit(1)

    if (!personResult) {
      return { redirectUrl: `${config.frontend.url}/login?error=account_not_found_or_inactive` }
    }

    const person = personResult.person
    const isTenantAdmin = person.role === 'owner' || person.role === 'admin'

    const token = await generateJWT({
      userId: person.id,
      email: normalizedEmail,
      name: normalizedEmail,
      tenantId: person.tenantId,
      isAdmin: false,
      isTenantAdmin,
    })

    return { redirectUrl: config.frontend.url, token }
  } catch (error) {
    logger.error({ err: error }, 'OAuth callback error')
    return { redirectUrl: `${config.frontend.url}/login?error=auth_failed` }
  }
}

export const getSession = async (token?: string): Promise<SessionResponse> => {
  if (!token) {
    return { session: null }
  }

  try {
    const payload = await verifyJWT(token)

    return {
      session: {
        user: {
          userId: payload.userId,
          email: payload.email,
          name: payload.name,
          tenantId: payload.tenantId,
          isAdmin: payload.isAdmin,
          isTenantAdmin: payload.isTenantAdmin,
        },
      },
    }
  } catch {
    return { session: null }
  }
}

export const getPending = async (token?: string): Promise<PendingResponse> => {
  if (!token) {
    return { pending: null }
  }

  try {
    const payload = await verifyPendingJWT(token)
    return {
      pending: {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
    }
  } catch {
    return { pending: null }
  }
}

export const requirePendingUser = async (token?: string): Promise<PendingUserPayload> => {
  if (!token) {
    throw unauthorized('No pending session')
  }

  try {
    return await verifyPendingJWT(token)
  } catch {
    throw unauthorized('Invalid or expired pending session')
  }
}

export const createTenantWithOwner = async (
  db: Database,
  input: { tenantName: string; ownerEmail: string }
) => {
  const normalizedEmail = input.ownerEmail.toLowerCase()

  const [existingEmail] = await db
    .select()
    .from(emails)
    .where(eq(emails.email, normalizedEmail))
    .limit(1)

  if (existingEmail) {
    throw conflict('Este email ya está registrado. Usa el botón de "Iniciar sesión con Google"')
  }

  const [defaultPlan] = await db.select().from(tenantPlans).limit(1)

  if (!defaultPlan) {
    throw internalError('No hay planes disponibles. Contacta al soporte.')
  }

  try {
    const result = await db.transaction(async (tx: DatabaseTransaction) => {
      const [emailRecord] = await tx
        .insert(emails)
        .values({ email: normalizedEmail })
        .returning()
      if (!emailRecord) {
        throw internalError('Failed to create email record')
      }

      const [tenant] = await tx
        .insert(tenants)
        .values({
          name: input.tenantName,
          planId: defaultPlan.id,
        })
        .returning()
      if (!tenant) {
        throw internalError('Failed to create tenant')
      }

      const [ownerPerson] = await tx
        .insert(people)
        .values({
          tenantId: tenant.id,
          emailId: emailRecord.id,
          role: 'owner',
        })
        .returning()
      if (!ownerPerson) {
        throw internalError('Failed to create owner person')
      }

      await tx.insert(tenantUsers).values({
        personId: ownerPerson.id,
      })

      return { tenant }
    })

    return {
      success: true,
      tenant: {
        id: result.tenant!.id,
        name: result.tenant!.name,
      },
    }
  } catch (error) {
    if (isHttpError(error)) {
      throw error
    }
    logger.error({ err: error }, 'Error creating tenant')
    throw internalError('Error al crear la organización')
  }
}

export const setupTenantFromPending = async (
  db: Database,
  body: unknown,
  pendingUser: PendingUserPayload
) => {
  const parsed = setupTenantInput.safeParse(body)

  if (!parsed.success) {
    throw badRequest('Invalid input', parsed.error.flatten())
  }

  const { tenantName, ownerName } = parsed.data
  const normalizedEmail = pendingUser.email.toLowerCase()

  const [existingEmail] = await db
    .select()
    .from(emails)
    .where(eq(emails.email, normalizedEmail))
    .limit(1)

  if (existingEmail) {
    throw conflict('Email already in use')
  }

  const [defaultPlan] = await db.select().from(tenantPlans).limit(1)

  if (!defaultPlan) {
    throw internalError('No plans available. Please contact support.')
  }

  const result = await db.transaction(async (tx: DatabaseTransaction) => {
    const [emailRecord] = await tx
      .insert(emails)
      .values({ email: normalizedEmail })
      .returning()

    if (!emailRecord) {
      throw internalError('Failed to create email record')
    }

    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: tenantName,
        planId: defaultPlan.id,
      })
      .returning()

    if (!tenant) {
      throw internalError('Failed to create tenant')
    }

    const [ownerPerson] = await tx
      .insert(people)
      .values({
        tenantId: tenant.id,
        emailId: emailRecord.id,
        role: 'owner',
      })
      .returning()

    if (!ownerPerson) {
      throw internalError('Failed to create owner person')
    }

    const [nameField] = await tx
      .insert(tenantPeopleFields)
      .values({
        tenantId: tenant.id,
        name: 'name',
        displayName: 'Nombre',
        fieldType: 'text',
        isRequired: true,
        displayOrder: 0,
      })
      .returning()

    if (nameField) {
      await tx.insert(tenantPeopleFieldValues).values({
        personId: ownerPerson.id,
        fieldId: nameField.id,
        value: ownerName,
      })
    }

    await tx.insert(tenantUsers).values({
      personId: ownerPerson.id,
    })

    return { tenant, ownerPerson }
  })

  const authToken = await generateJWT({
    userId: result.ownerPerson.id,
    email: normalizedEmail,
    name: ownerName,
    tenantId: result.tenant.id,
    isAdmin: false,
    isTenantAdmin: true,
  })

  return {
    authToken,
    tenant: {
      id: result.tenant.id,
      name: result.tenant.name,
    },
  }
}
