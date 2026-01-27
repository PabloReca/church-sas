import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { authGuard, tenantUserGuard } from '@/lib/elysia/guards'
import { createFieldInput, updateFieldInput, deleteFieldInput } from '@/db/schemas-zod'
import { parseTenantId } from '@/lib/params'
import * as controller from '@/controllers/people/fields'

export const peopleFieldsRoutes = new Elysia({ prefix: '/rpc/people-fields', tags: ['Person Fields'] })
  .use(contextPlugin)
  .use(authGuard)
  .use(tenantUserGuard)
  .post('/', async ({ db, body }) => {
    return await controller.createField(db, body)
  }, {
    body: createFieldInput,
    detail: { summary: 'Create a custom field for a tenant' }
  })
  .patch('/', async ({ db, body }) => {
    return await controller.updateField(db, body)
  }, {
    body: updateFieldInput,
    detail: { summary: 'Update a custom field' }
  })
  .delete('/', async ({ db, body }) => {
    return await controller.deleteField(db, body)
  }, {
    body: deleteFieldInput,
    detail: { summary: 'Delete a custom field (cascades to all values)' }
  })
  .get('/:tenantId', async ({ db, params }) => {
    return await controller.listFields(db, parseTenantId(params.tenantId))
  }, {
    params: t.Object({ tenantId: t.String() }),
    detail: { summary: 'List all custom fields for a tenant' }
  })
