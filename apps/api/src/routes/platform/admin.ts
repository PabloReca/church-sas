import Elysia from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { adminGuard } from '@/lib/elysia/guards'
import { addAdminInput, removeAdminInput } from '@/db/schemas-zod'
import * as adminController from '@/controllers/platform/admin'

export const adminRoutes = new Elysia({ prefix: '/rpc/admin', tags: ['Admin'] })
  .use(contextPlugin)
  .use(adminGuard)
  .get('/', async ({ db }) => {
    return await adminController.listAdmins(db)
  }, {
    detail: { summary: 'List all global administrators' }
  })
  .post('/', async ({ db, body }) => {
    return await adminController.addAdmin(db, body)
  }, {
    body: addAdminInput,
    detail: { summary: 'Add a global administrator' }
  })
  .delete('/', async ({ db, body }) => {
    return await adminController.removeAdmin(db, body)
  }, {
    body: removeAdminInput,
    detail: { summary: 'Remove a global administrator' }
  })
