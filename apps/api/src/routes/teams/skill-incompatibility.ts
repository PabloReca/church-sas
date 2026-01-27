import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { authGuard, tenantManagerGuard, tenantUserGuard } from '@/lib/elysia/guards'
import { addSkillIncompatibilityInput, removeSkillIncompatibilityInput } from '@/db/schemas-zod'
import { parseTenantId } from '@/lib/params'
import * as controller from '@/controllers/teams/skill-incompatibility'

const managerRoutes = new Elysia()
  .use(contextPlugin)
  .use(tenantManagerGuard)
  .post('/', async ({ db, body }) => {
    return await controller.addSkillIncompatibility(db, body)
  }, {
    body: addSkillIncompatibilityInput,
    detail: { summary: 'Add skill incompatibility rule' }
  })
  .delete('/', async ({ db, body }) => {
    return await controller.removeSkillIncompatibility(db, body)
  }, {
    body: removeSkillIncompatibilityInput,
    detail: { summary: 'Remove skill incompatibility rule' }
  })

const userRoutes = new Elysia()
  .use(contextPlugin)
  .use(tenantUserGuard)
  .get('/:tenantId', async ({ db, params }) => {
    return await controller.listSkillIncompatibilities(db, parseTenantId(params.tenantId))
  }, {
    params: t.Object({ tenantId: t.String() }),
    detail: { summary: 'List skill incompatibility rules' }
  })

export const teamSkillIncompatibilityRoutes = new Elysia({ prefix: '/rpc/skill-incompatibility', tags: ['Team Skills'] })
  .use(contextPlugin)
  .use(authGuard)
  .use(managerRoutes)
  .use(userRoutes)
