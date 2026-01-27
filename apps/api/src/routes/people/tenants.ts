import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { authGuard, tenantUserGuard } from '@/lib/elysia/guards'
import { parseTenantId } from '@/lib/params'
import * as controller from '@/controllers/people/tenants'

export const peopleTenantsRoutes = new Elysia({ prefix: '/rpc/people-tenants', tags: ['People'] })
  .use(contextPlugin)
  .use(authGuard)
  .get('/my-tenants', async ({ db, user }) => {
    return await controller.myTenants(db, user.userId)
  }, {
    detail: { summary: 'Get tenants for current person (primary + helpers)' }
  })
  .use(tenantUserGuard)
  .get('/list/:tenantId', async ({ db, params }) => {
    return await controller.listTenantPeople(db, parseTenantId(params.tenantId))
  }, {
    params: t.Object({ tenantId: t.String() }),
    detail: { summary: 'List people in a tenant (members + helpers)' }
  })
