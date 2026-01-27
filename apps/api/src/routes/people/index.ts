import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { authGuard, tenantUserGuard } from '@/lib/elysia/guards'
import { createPersonInput, updatePersonInput } from '@/db/schemas-zod'
import { isAdmin } from '@/lib/auth/helpers'
import { forbidden, notFound } from '@/lib/http-errors'
import { parsePersonId, parseTenantId } from '@/lib/params'
import * as peopleController from '@/controllers/people/index'
import * as peopleTenantsController from '@/controllers/people/tenants'

const tenantRoutes = new Elysia()
  .use(contextPlugin)
  .use(tenantUserGuard)
  .get('/tenant/:tenantId/:personId', async ({ db, params }) => {
    return await peopleTenantsController.getTenantPerson(db, parseTenantId(params.tenantId), parsePersonId(params.personId))
  }, {
    params: t.Object({ tenantId: t.String(), personId: t.String() }),
    detail: { summary: 'Get a specific person in a tenant' }
  })
  .post('/', async ({ db, body }) => {
    return await peopleController.createPerson(db, body)
  }, {
    body: createPersonInput,
    detail: { summary: 'Create a new person' }
  })

const userRoutes = new Elysia()
  .use(contextPlugin)
  .use(authGuard)
  .get('/me', async ({ db, user }) => {
    const result = await peopleController.getPersonWithStatus(db, user.userId)
    if (!result) {
      throw notFound('Person not found')
    }
    return result
  }, {
    detail: { summary: 'Get current person' }
  })
  .get('/:personId', async ({ db, params, user }) => {
    const personId = parsePersonId(params.personId)
    if (user.userId !== personId && !user.isAdmin) {
      throw forbidden('Access denied')
    }
    const result = await peopleController.getPerson(db, personId)
    if (!result) {
      throw notFound('Person not found')
    }
    return result
  }, {
    params: t.Object({ personId: t.String() }),
    detail: { summary: 'Get person by ID' }
  })
  .patch('/', async ({ db, body, user }) => {
    if (user.userId !== body.personId && !user.isAdmin) {
      throw forbidden('Access denied')
    }
    const allowActiveChange = isAdmin(user)
    return await peopleController.updatePerson(db, body, { allowActiveChange })
  }, {
    body: updatePersonInput,
    detail: { summary: 'Update person' }
  })
  .delete('/:personId', async ({ db, params, user }) => {
    const personId = parsePersonId(params.personId)
    if (user.userId !== personId) {
      throw forbidden('You can only delete your own account')
    }
    return await peopleController.deletePerson(db, personId)
  }, {
    params: t.Object({ personId: t.String() }),
    detail: { summary: 'Delete own account' }
  })

export const peopleRoutes = new Elysia({ prefix: '/rpc/people', tags: ['People'] })
  .use(contextPlugin)
  .use(userRoutes)
  .use(tenantRoutes)
