import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { authGuard, tenantManagerGuard, tenantUserGuard } from '@/lib/elysia/guards'
import {
  createEventTemplateInput,
  updateEventTemplateInput,
  deleteEventTemplateInput,
  createEventTemplateSlotInput,
  updateEventTemplateSlotInput,
  deleteEventTemplateSlotInput,
} from '@/db/schemas-zod'
import { parseId, parseTenantId } from '@/lib/params'
import * as controller from '@/controllers/events/templates'

const managerRoutes = new Elysia()
  .use(contextPlugin)
  .use(tenantManagerGuard)
  .post('/', async ({ db, body }) => {
    return await controller.createEventTemplate(db, body)
  }, {
    body: createEventTemplateInput,
    detail: { summary: 'Create an event template' }
  })
  .patch('/', async ({ db, body }) => {
    return await controller.updateEventTemplate(db, body)
  }, {
    body: updateEventTemplateInput,
    detail: { summary: 'Update an event template' }
  })
  .delete('/template', async ({ db, body }) => {
    return await controller.deleteEventTemplate(db, body)
  }, {
    body: deleteEventTemplateInput,
    detail: { summary: 'Delete an event template' }
  })
  .post('/slot', async ({ db, body }) => {
    return await controller.createEventTemplateSlot(db, body)
  }, {
    body: createEventTemplateSlotInput,
    detail: { summary: 'Create a template slot' }
  })
  .patch('/slot', async ({ db, body }) => {
    return await controller.updateEventTemplateSlot(db, body)
  }, {
    body: updateEventTemplateSlotInput,
    detail: { summary: 'Update a template slot' }
  })
  .delete('/slot', async ({ db, body }) => {
    return await controller.deleteEventTemplateSlot(db, body)
  }, {
    body: deleteEventTemplateSlotInput,
    detail: { summary: 'Delete a template slot' }
  })

const userRoutes = new Elysia()
  .use(contextPlugin)
  .use(tenantUserGuard)
  .get('/:tenantId/:templateId', async ({ db, params }) => {
    return await controller.getEventTemplate(db, parseTenantId(params.tenantId), parseId(params.templateId))
  }, {
    params: t.Object({ tenantId: t.String(), templateId: t.String() }),
    detail: { summary: 'Get an event template' }
  })
  .get('/list/:tenantId', async ({ db, params }) => {
    return await controller.listEventTemplates(db, parseTenantId(params.tenantId))
  }, {
    params: t.Object({ tenantId: t.String() }),
    detail: { summary: 'List event templates' }
  })
  .get('/slots/:tenantId/:templateId', async ({ db, params }) => {
    return await controller.listEventTemplateSlots(db, parseTenantId(params.tenantId), parseId(params.templateId))
  }, {
    params: t.Object({ tenantId: t.String(), templateId: t.String() }),
    detail: { summary: 'List template slots' }
  })

export const eventTemplatesRoutes = new Elysia({ prefix: '/rpc/event-templates', tags: ['Event Templates'] })
  .use(contextPlugin)
  .use(authGuard)
  .use(managerRoutes)
  .use(userRoutes)
