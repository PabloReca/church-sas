import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { authGuard, tenantManagerGuard, tenantUserGuard } from '@/lib/elysia/guards'
import { createEventSlotInput, updateEventSlotInput, deleteEventSlotInput } from '@/db/schemas-zod'
import { parseId, parseTenantId } from '@/lib/params'
import * as controller from '@/controllers/events/slots'

const managerRoutes = new Elysia()
  .use(contextPlugin)
  .use(tenantManagerGuard)
  .post('/', async ({ db, body }) => {
    return await controller.createEventSlot(db, body)
  }, {
    body: createEventSlotInput,
    detail: { summary: 'Create an event slot' }
  })
  .patch('/', async ({ db, body }) => {
    return await controller.updateEventSlot(db, body)
  }, {
    body: updateEventSlotInput,
    detail: { summary: 'Update an event slot' }
  })
  .delete('/', async ({ db, body }) => {
    return await controller.deleteEventSlot(db, body)
  }, {
    body: deleteEventSlotInput,
    detail: { summary: 'Delete an event slot' }
  })

const userRoutes = new Elysia()
  .use(contextPlugin)
  .use(tenantUserGuard)
  .get('/:tenantId/:eventId', async ({ db, params }) => {
    return await controller.listEventSlots(db, parseTenantId(params.tenantId), parseId(params.eventId))
  }, {
    params: t.Object({ tenantId: t.String(), eventId: t.String() }),
    detail: { summary: 'List event slots' }
  })

export const eventSlotsRoutes = new Elysia({ prefix: '/rpc/event-slots', tags: ['Event Slots'] })
  .use(contextPlugin)
  .use(authGuard)
  .use(managerRoutes)
  .use(userRoutes)
