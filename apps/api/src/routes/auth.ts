import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { emails, admins, people, tenantUsers, tenants, tenantPlans, tenantPeopleFields, tenantPeopleFieldValues } from '@/db/schema'
import { getDb } from '@/db/connection'
import { verifyGoogleToken } from '@/lib/google'
import { generateJWT, verifyJWT, generatePendingJWT, verifyPendingJWT } from '@/lib/jwt'
import { config } from '@/config'
import { eq } from 'drizzle-orm'
import { setupTenantInput } from '@/db/schemas-zod'
import { logger } from '@/lib/logger'

const auth = new Hono()

// Google OAuth redirect
auth.get('/google', (c) => {
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')

  googleAuthUrl.searchParams.set('client_id', config.google.clientId)
  googleAuthUrl.searchParams.set('redirect_uri', config.google.callbackUrl)
  googleAuthUrl.searchParams.set('response_type', 'code')
  googleAuthUrl.searchParams.set('scope', 'openid email profile')
  googleAuthUrl.searchParams.set('access_type', 'offline')
  googleAuthUrl.searchParams.set('prompt', 'consent')

  return c.redirect(googleAuthUrl.toString())
})

// Google OAuth callback
auth.get('/google/callback', async (c) => {
  const code = c.req.query('code')

  if (!code) {
    return c.redirect(`${config.frontend.url}/login?error=no_code`)
  }

  try {
    const db = getDb()

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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

    if (!tokenResponse.ok) {
      return c.redirect(`${config.frontend.url}/login?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json() as { id_token: string }

    const googleUser = await verifyGoogleToken(tokens.id_token)
    if (!googleUser) {
      return c.redirect(`${config.frontend.url}/login?error=invalid_token`)
    }

    const normalizedEmail = googleUser.email.toLowerCase()

    // Find email record
    const [emailRecord] = await db
      .select()
      .from(emails)
      .where(eq(emails.email, normalizedEmail))
      .limit(1)

    // If email doesn't exist, create a pending token and redirect to setup
    if (!emailRecord) {
      const pendingToken = await generatePendingJWT({
        email: normalizedEmail,
        name: googleUser.name || '',
        picture: googleUser.picture || null,
      })

      setCookie(c, 'pending_token', pendingToken, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'Lax',
        maxAge: 60 * 60, // 1 hour
        path: '/',
      })

      return c.redirect(`${config.frontend.url}/setup-tenant`)
    }

    // Check if email is a global admin
    const [globalAdmin] = await db
      .select()
      .from(admins)
      .where(eq(admins.emailId, emailRecord.id))
      .limit(1)

    const isGlobalAdmin = !!globalAdmin

    // Find active person by email (person with active seat)
    const [personResult] = await db
      .select({
        person: people,
      })
      .from(people)
      .innerJoin(tenantUsers, eq(people.id, tenantUsers.personId))
      .where(eq(people.emailId, emailRecord.id))
      .limit(1)

    // If admin but not a person, create session for admin
    if (isGlobalAdmin && !personResult) {
      const token = await generateJWT({
        userId: globalAdmin.id,
        email: normalizedEmail,
        name: globalAdmin.name || 'Admin',
        tenantId: 0, // No tenant for pure admins
        isAdmin: true,
        isTenantAdmin: false,
      })

      setCookie(c, 'auth_token', token, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })

      return c.redirect(config.frontend.url)
    }

    if (!personResult) {
      return c.redirect(`${config.frontend.url}/login?error=account_not_found_or_inactive`)
    }

    const person = personResult.person

    // Check if person is a tenant owner or admin (role is directly on people table now)
    const isTenantAdmin = person.role === 'owner' || person.role === 'admin'

    const token = await generateJWT({
      userId: person.id,
      email: normalizedEmail,
      name: normalizedEmail, // Use email as display name for now (fields are dynamic)
      tenantId: person.tenantId,
      isAdmin: isGlobalAdmin,
      isTenantAdmin,
    })

    // Set cookie
    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    // Redirect to frontend
    return c.redirect(config.frontend.url)
  } catch (error) {
    logger.error({ err: error }, 'OAuth callback error')
    return c.redirect(`${config.frontend.url}/login?error=auth_failed`)
  }
})

// Get current session
auth.get('/session', async (c) => {
  const token = getCookie(c, 'auth_token')

  if (!token) {
    return c.json({ session: null })
  }

  try {
    const payload = await verifyJWT(token)

    return c.json({
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
    })
  } catch {
    return c.json({ session: null })
  }
})

// Logout
auth.post('/logout', (c) => {
  deleteCookie(c, 'auth_token')
  return c.json({ success: true })
})

// Get pending user info (for setup-tenant page)
auth.get('/pending', async (c) => {
  const token = getCookie(c, 'pending_token')

  if (!token) {
    return c.json({ pending: null })
  }

  try {
    const payload = await verifyPendingJWT(token)
    return c.json({
      pending: {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
    })
  } catch {
    deleteCookie(c, 'pending_token')
    return c.json({ pending: null })
  }
})

// Cancel pending setup
auth.post('/pending/cancel', (c) => {
  deleteCookie(c, 'pending_token')
  return c.json({ success: true })
})

// Setup tenant (create tenant + owner from pending token)
auth.post('/setup-tenant', async (c) => {
  const token = getCookie(c, 'pending_token')

  if (!token) {
    return c.json({ error: 'No pending session' }, 401)
  }

  let pendingUser
  try {
    pendingUser = await verifyPendingJWT(token)
  } catch {
    deleteCookie(c, 'pending_token')
    return c.json({ error: 'Invalid or expired pending session' }, 401)
  }

  const body = await c.req.json()
  const parsed = setupTenantInput.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400)
  }

  const { tenantName, ownerName } = parsed.data
  const normalizedEmail = pendingUser.email.toLowerCase()

  const db = getDb()

  // Generate slug from tenant name
  const slug = tenantName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100)

  // Check if slug already exists
  const [existingTenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1)

  if (existingTenant) {
    return c.json({ error: 'A tenant with a similar name already exists' }, 409)
  }

  // Check if email already exists (shouldn't happen, but just in case)
  const [existingEmail] = await db
    .select()
    .from(emails)
    .where(eq(emails.email, normalizedEmail))
    .limit(1)

  if (existingEmail) {
    deleteCookie(c, 'pending_token')
    return c.json({ error: 'Email already in use' }, 409)
  }

  // Get the free plan (or first plan available)
  const [defaultPlan] = await db
    .select()
    .from(tenantPlans)
    .limit(1)

  if (!defaultPlan) {
    return c.json({ error: 'No plans available. Please contact support.' }, 500)
  }

  // Create tenant + owner in a transaction
  const result = await db.transaction(async (tx) => {
    // 1. Create email record
    const [emailRecord] = await tx
      .insert(emails)
      .values({ email: normalizedEmail })
      .returning()

    if (!emailRecord) {
      throw new Error('Failed to create email record')
    }

    // 2. Create tenant
    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: tenantName,
        slug,
        planId: defaultPlan.id,
      })
      .returning()

    if (!tenant) {
      throw new Error('Failed to create tenant')
    }

    // 3. Create owner person with role
    const [ownerPerson] = await tx
      .insert(people)
      .values({
        tenantId: tenant.id,
        emailId: emailRecord.id,
        role: 'owner',
      })
      .returning()

    if (!ownerPerson) {
      throw new Error('Failed to create owner person')
    }

    // 4. Create default "name" field for this tenant and set owner's name
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

    // 5. Activate owner person seat
    await tx.insert(tenantUsers).values({
      personId: ownerPerson.id,
    })

    return { tenant, ownerPerson, emailRecord }
  })

  // Generate auth token for the new user
  const authToken = await generateJWT({
    userId: result.ownerPerson.id,
    email: normalizedEmail,
    name: ownerName,
    tenantId: result.tenant.id,
    isAdmin: false,
    isTenantAdmin: true,
  })

  // Clear pending token and set auth token
  deleteCookie(c, 'pending_token')
  setCookie(c, 'auth_token', authToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  return c.json({
    success: true,
    tenant: {
      id: result.tenant.id,
      name: result.tenant.name,
      slug: result.tenant.slug,
    },
  })
})

export default auth
