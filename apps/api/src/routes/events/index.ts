import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { authGuard, tenantManagerGuard, tenantUserGuard } from '@/lib/elysia/guards'
import { createEventInput, updateEventInput, deleteEventInput } from '@/db/schemas-zod'
import { parseId, parseTenantId } from '@/lib/params'
import * as controller from '@/controllers/events/index'

const managerRoutes = new Elysia()
  .use(contextPlugin)
  .use(tenantManagerGuard)
  .post('/', async ({ db, body }) => {
    return await controller.createEvent(db, body)
  }, {
    body: createEventInput,
    detail: { summary: 'Create an event' }
  })
  .patch('/', async ({ db, body }) => {
    return await controller.updateEvent(db, body)
  }, {
    body: updateEventInput,
    detail: { summary: 'Update an event' }
  })
  .delete('/', async ({ db, body }) => {
    return await controller.deleteEvent(db, body)
  }, {
    body: deleteEventInput,
    detail: { summary: 'Delete an event' }
  })

const userRoutes = new Elysia()
  .use(contextPlugin)
  .use(tenantUserGuard)
  .get('/:tenantId/:eventId', async ({ db, params }) => {
    return await controller.getEvent(db, parseTenantId(params.tenantId), parseId(params.eventId))
  }, {
    params: t.Object({ tenantId: t.String(), eventId: t.String() }),
    detail: { summary: 'Get an event by ID' }
  })
  .get('/list/:tenantId', async ({ db, params }) => {
    return await controller.listEvents(db, parseTenantId(params.tenantId))
  }, {
    params: t.Object({ tenantId: t.String() }),
    detail: { summary: 'List events in a tenant' }
  })

export const eventsRoutes = new Elysia({ prefix: '/rpc/events', tags: ['Events'] })
  .use(contextPlugin)
  .use(authGuard)
  .use(managerRoutes)
  .use(userRoutes)
