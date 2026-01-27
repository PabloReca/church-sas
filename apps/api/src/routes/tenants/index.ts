import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { adminGuard, authGuard } from '@/lib/elysia/guards'
import { createTenantInput, updateTenantInput, tenantIdInput } from '@/db/schemas-zod'
import { parseTenantId } from '@/lib/params'
import * as controller from '@/controllers/tenants'

const adminRoutes = new Elysia()
  .use(contextPlugin)
  .use(adminGuard)
  .get('/list', async ({ db }) => {
    return await controller.listTenants(db)
  }, {
    detail: { summary: 'List all tenants' }
  })
  .get('/:tenantId/people-count', async ({ db, params }) => {
    return await controller.getPeopleCount(db, parseTenantId(params.tenantId))
  }, {
    params: t.Object({ tenantId: t.String() }),
    detail: { summary: 'Get people count for a tenant' }
  })
  .post('/', async ({ db, body }) => {
    return await controller.createTenant(db, body)
  }, {
    body: createTenantInput,
    detail: { summary: 'Create a new tenant' }
  })
  .patch('/', async ({ db, body }) => {
    return await controller.updateTenant(db, body)
  }, {
    body: updateTenantInput,
    detail: { summary: 'Update a tenant' }
  })
  .delete('/', async ({ db, body }) => {
    return await controller.deleteTenant(db, body)
  }, {
    body: tenantIdInput,
    detail: { summary: 'Delete a tenant' }
  })

const userRoutes = new Elysia()
  .use(contextPlugin)
  .use(authGuard)
  .get('/:tenantId', async ({ db, params }) => {
    return await controller.getTenantById(db, parseTenantId(params.tenantId))
  }, {
    params: t.Object({ tenantId: t.String() }),
    detail: { summary: 'Get tenant by ID' }
  })

export const tenantsRoutes = new Elysia({ prefix: '/rpc/tenants', tags: ['Tenants'] })
  .use(contextPlugin)
  .use(adminRoutes)
  .use(userRoutes)
