import { Hono } from 'hono'
import { parse } from 'csv-parse/sync'
import { verifyJWT } from '@/lib/jwt'
import { people, emails, tenantPeopleFields, tenantPeopleFieldValues } from '@/db/schema'
import { getDb } from '@/db/connection'
import { requireAdmin } from '@/lib/auth-helpers'
import { eq } from 'drizzle-orm'

const csv = new Hono()

// Dynamic CSV import - columns are matched to tenant's person fields
csv.post('/', async (c) => {
  const token = c.req.header('cookie')?.match(/auth_token=([^;]+)/)?.[1]
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const user = await verifyJWT(token).catch(() => null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  try {
    requireAdmin(user)
  } catch {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const tenantId = parseInt(formData.get('tenantId') as string)

  if (!file || isNaN(tenantId)) return c.json({ error: 'Missing file or tenantId' }, 400)

  const db = getDb()

  // Get tenant's field definitions
  const fields = await db
    .select()
    .from(tenantPeopleFields)
    .where(eq(tenantPeopleFields.tenantId, tenantId))

  const fieldMap = new Map(fields.map(f => [f.name.toLowerCase(), f]))

  const records = parse(await file.text(), { columns: true, skip_empty_lines: true }) as Record<string, string>[]

  let imported = 0
  const errors: string[] = []

  for (const row of records) {
    try {
      // Handle email specially - it's required
      const emailValue = row['email']?.toLowerCase().trim()

      if (!emailValue) {
        errors.push('Row missing required email field, skipping')
        continue
      }

      let [emailRecord] = await db
        .select()
        .from(emails)
        .where(eq(emails.email, emailValue))
        .limit(1)

      if (emailRecord) {
        errors.push(`Email ${emailValue} already exists, skipping row`)
        continue
      }

      [emailRecord] = await db
        .insert(emails)
        .values({ email: emailValue })
        .returning()

      if (!emailRecord) {
        errors.push('Failed to create email record')
        continue
      }

      // Create person
      const [person] = await db
        .insert(people)
        .values({ tenantId, emailId: emailRecord.id })
        .returning()

      if (!person) {
        errors.push('Failed to create person')
        continue
      }

      // Insert field values for each column that matches a field
      for (const [columnName, value] of Object.entries(row)) {
        if (columnName.toLowerCase() === 'email') continue // Already handled

        const field = fieldMap.get(columnName.toLowerCase())
        if (field && value) {
          await db.insert(tenantPeopleFieldValues).values({
            personId: person.id,
            fieldId: field.id,
            value: value.trim(),
          })
        }
      }

      imported++
    } catch (error) {
      console.error('CSV import error:', error)
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  return c.json({
    success: true,
    imported,
    total: records.length,
    errors: errors.length > 0 ? errors : undefined,
  })
})

export default csv
