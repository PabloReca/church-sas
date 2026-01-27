import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { authGuard, tenantUserGuard } from '@/lib/elysia/guards'
import { createTeamInput, updateTeamInput, deleteTeamInput } from '@/db/schemas-zod'
import { parseId, parseTenantId } from '@/lib/params'
import * as teamsController from '@/controllers/teams/index'

export const teamsRoutes = new Elysia({ prefix: '/rpc/teams', tags: ['Teams'] })
  .use(contextPlugin)
  .use(authGuard)
  .use(tenantUserGuard)
  .post('/', async ({ db, body }) => {
    return await teamsController.createTeam(db, body)
  }, {
    body: createTeamInput,
    detail: { summary: 'Create a team' }
  })
  .get('/list/:tenantId', async ({ db, params }) => {
    return await teamsController.listTeams(db, parseTenantId(params.tenantId))
  }, {
    params: t.Object({ tenantId: t.String() }),
    detail: { summary: 'List teams in a tenant' }
  })
  .get('/:tenantId/:teamId', async ({ db, params }) => {
    return await teamsController.getTeam(db, parseTenantId(params.tenantId), parseId(params.teamId))
  }, {
    params: t.Object({ tenantId: t.String(), teamId: t.String() }),
    detail: { summary: 'Get a specific team' }
  })
  .patch('/', async ({ db, body }) => {
    return await teamsController.updateTeam(db, body)
  }, {
    body: updateTeamInput,
    detail: { summary: 'Update a team' }
  })
  .delete('/', async ({ db, body }) => {
    return await teamsController.deleteTeam(db, body.tenantId, body.teamId)
  }, {
    body: deleteTeamInput,
    detail: { summary: 'Delete a team' }
  })
