import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { adminGuard, authGuard } from '@/lib/elysia/guards'
import {
  setPersonRoleInput,
  addHelperInput,
  removeHelperInput,
  addTenantUserInput,
  removeTenantUserInput,
} from '@/db/schemas-zod'
import { parsePersonId, parseTenantId } from '@/lib/params'
import * as controller from '@/controllers/tenants/users'

const adminRoutes = new Elysia()
  .use(contextPlugin)
  .use(adminGuard)
  .post('/person-role', async ({ db, body }) => {
    return await controller.setPersonRole(db, body)
  }, {
    body: setPersonRoleInput,
    detail: { summary: "Set person's role (owner/admin/null)" }
  })
  .post('/helpers', async ({ db, body }) => {
    return await controller.addHelper(db, body)
  }, {
    body: addHelperInput,
    detail: { summary: 'Add a person as helper to a tenant' }
  })
  .delete('/helpers', async ({ db, body }) => {
    return await controller.removeHelper(db, body)
  }, {
    body: removeHelperInput,
    detail: { summary: 'Remove a helper from a tenant' }
  })
  .post('/', async ({ db, body }) => {
    return await controller.addTenantUser(db, body)
  }, {
    body: addTenantUserInput,
    detail: { summary: 'Add a tenant user (enable login)' }
  })
  .delete('/', async ({ db, body }) => {
    return await controller.removeTenantUser(db, body)
  }, {
    body: removeTenantUserInput,
    detail: { summary: 'Remove a tenant user (disable login)' }
  })

const userRoutes = new Elysia()
  .use(contextPlugin)
  .use(authGuard)
  .get('/person-role/:personId', async ({ db, params }) => {
    return await controller.getPersonRole(db, { personId: parsePersonId(params.personId) })
  }, {
    params: t.Object({ personId: t.String() }),
    detail: { summary: "Get person's role (owner/admin/null)" }
  })
  .get('/helpers/:tenantId', async ({ db, params }) => {
    return await controller.listHelpers(db, { tenantId: parseTenantId(params.tenantId) })
  }, {
    params: t.Object({ tenantId: t.String() }),
    detail: { summary: 'List all helpers for a tenant' }
  })
  .get('/count/:tenantId', async ({ db, params }) => {
    return await controller.countTenantUsers(db, { tenantId: parseTenantId(params.tenantId) })
  }, {
    params: t.Object({ tenantId: t.String() }),
    detail: { summary: 'Count tenant users' }
  })

export const tenantUsersRoutes = new Elysia({ prefix: '/rpc/tenant-users', tags: ['Access Management'] })
  .use(contextPlugin)
  .use(adminRoutes)
  .use(userRoutes)
