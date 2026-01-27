import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { authGuard, tenantUserGuard } from '@/lib/elysia/guards'
import { addTeamMemberInput, removeTeamMemberInput, updateTeamMemberInput } from '@/db/schemas-zod'
import { parseId, parseTenantId } from '@/lib/params'
import * as controller from '@/controllers/teams/members'

export const teamMembersRoutes = new Elysia({ prefix: '/rpc/team-members', tags: ['Team Members'] })
  .use(contextPlugin)
  .use(authGuard)
  .use(tenantUserGuard)
  .post('/', async ({ db, body }) => {
    return await controller.addTeamMember(db, body)
  }, {
    body: addTeamMemberInput,
    detail: { summary: 'Add a member to a team' }
  })
  .get('/:tenantId/:teamId', async ({ db, params }) => {
    return await controller.listTeamMembers(db, parseTenantId(params.tenantId), parseId(params.teamId))
  }, {
    params: t.Object({ tenantId: t.String(), teamId: t.String() }),
    detail: { summary: 'List members of a team' }
  })
  .patch('/', async ({ db, body }) => {
    return await controller.updateTeamMember(db, body)
  }, {
    body: updateTeamMemberInput,
    detail: { summary: 'Update a team member' }
  })
  .delete('/', async ({ db, body }) => {
    return await controller.removeTeamMember(db, body)
  }, {
    body: removeTeamMemberInput,
    detail: { summary: 'Remove a team member' }
  })
