import Elysia from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { adminGuard } from '@/lib/elysia/guards'
import { createPlanInput, updatePlanInput, planIdInput } from '@/db/schemas-zod'
import * as plansController from '@/controllers/platform/plans'

export const plansRoutes = new Elysia({ prefix: '/rpc/plans', tags: ['Plans'] })
  .use(contextPlugin)
  .use(adminGuard)
  .get('/', async ({ db }) => {
    return await plansController.listPlans(db)
  }, {
    detail: { summary: 'List all plans' }
  })
  .post('/', async ({ db, body }) => {
    return await plansController.createPlan(db, body)
  }, {
    body: createPlanInput,
    detail: { summary: 'Create a plan' }
  })
  .patch('/', async ({ db, body }) => {
    return await plansController.updatePlan(db, body)
  }, {
    body: updatePlanInput,
    detail: { summary: 'Update a plan' }
  })
  .delete('/', async ({ db, body }) => {
    return await plansController.deletePlan(db, body)
  }, {
    body: planIdInput,
    detail: { summary: 'Delete a plan' }
  })
