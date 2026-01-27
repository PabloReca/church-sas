import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { authGuard, tenantUserGuard } from '@/lib/elysia/guards'
import {
  createTeamSkillInput,
  updateTeamSkillInput,
  deleteTeamSkillInput,
  assignMemberSkillInput,
  removeMemberSkillInput,
} from '@/db/schemas-zod'
import { parseId, parseTenantId } from '@/lib/params'
import * as controller from '@/controllers/teams/skills'

export const teamSkillsRoutes = new Elysia({ prefix: '/rpc/team-skills', tags: ['Team Skills'] })
  .use(contextPlugin)
  .use(authGuard)
  .use(tenantUserGuard)
  .post('/', async ({ db, body }) => {
    return await controller.createTeamSkill(db, body)
  }, {
    body: createTeamSkillInput,
    detail: { summary: 'Create a team skill' }
  })
  .get('/:tenantId/:teamId', async ({ db, params }) => {
    return await controller.listTeamSkills(db, parseTenantId(params.tenantId), parseId(params.teamId))
  }, {
    params: t.Object({ tenantId: t.String(), teamId: t.String() }),
    detail: { summary: 'List skills for a team' }
  })
  .patch('/', async ({ db, body }) => {
    return await controller.updateTeamSkill(db, body)
  }, {
    body: updateTeamSkillInput,
    detail: { summary: 'Update a team skill' }
  })
  .delete('/skill', async ({ db, body }) => {
    return await controller.deleteTeamSkill(db, body.tenantId, body.skillId)
  }, {
    body: deleteTeamSkillInput,
    detail: { summary: 'Delete a team skill' }
  })
  .post('/member-skill', async ({ db, body }) => {
    return await controller.assignMemberSkill(db, body)
  }, {
    body: assignMemberSkillInput,
    detail: { summary: 'Assign a skill to a team member' }
  })
  .get('/member-skills/:tenantId/:teamMemberId', async ({ db, params }) => {
    return await controller.listMemberSkills(db, parseTenantId(params.tenantId), parseId(params.teamMemberId))
  }, {
    params: t.Object({ tenantId: t.String(), teamMemberId: t.String() }),
    detail: { summary: 'List skills for a team member' }
  })
  .delete('/member-skill', async ({ db, body }) => {
    return await controller.removeMemberSkill(db, body.tenantId, body.teamMemberId, body.skillId)
  }, {
    body: removeMemberSkillInput,
    detail: { summary: 'Remove a skill from a team member' }
  })
