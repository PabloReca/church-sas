import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { authGuard, tenantManagerGuard, tenantUserGuard } from '@/lib/elysia/guards'
import { createEventAssignmentInput, deleteEventAssignmentInput } from '@/db/schemas-zod'
import { parseId, parseTenantId } from '@/lib/params'
import * as controller from '@/controllers/events/assignments'

const managerRoutes = new Elysia()
  .use(contextPlugin)
  .use(tenantManagerGuard)
  .post('/', async ({ db, body }) => {
    return await controller.createAssignment(db, body)
  }, {
    body: createEventAssignmentInput,
    detail: { summary: 'Assign a person to an event slot' }
  })
  .delete('/', async ({ db, body }) => {
    return await controller.deleteAssignment(db, body)
  }, {
    body: deleteEventAssignmentInput,
    detail: { summary: 'Remove an event assignment' }
  })

const userRoutes = new Elysia()
  .use(contextPlugin)
  .use(tenantUserGuard)
  .get('/:tenantId/:eventId', async ({ db, params }) => {
    return await controller.listAssignments(db, parseTenantId(params.tenantId), parseId(params.eventId))
  }, {
    params: t.Object({ tenantId: t.String(), eventId: t.String() }),
    detail: { summary: 'List event assignments' }
  })

export const eventAssignmentsRoutes = new Elysia({ prefix: '/rpc/event-assignments', tags: ['Event Assignments'] })
  .use(contextPlugin)
  .use(authGuard)
  .use(managerRoutes)
  .use(userRoutes)
