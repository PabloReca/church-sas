import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { eventAssignmentsRoutes } from '@/routes/events/assignments'
import { createAccessFixture, type AccessFixture } from '../../../tests/fixtures/access'
import {
  assignTeamMemberSkill,
  createTeam,
  createTeamMember,
  createTeamSkill,
} from '../../../tests/fixtures/teams'
import { createEvent, createEventSlot } from '../../../tests/fixtures/events'
import { makeJsonRequest, readJson } from '../../../tests/http'
import { tenantUsers, tenantSkillIncompatibility } from '@/db/schema'

describe('event assignments routes', () => {
  let fixture: AccessFixture

  beforeAll(async () => {
    fixture = await createAccessFixture('event-assignments')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('creates and lists assignments', async () => {
    const { teamId } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team ${fixture.runId}`
    )
    const { skillId } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      teamId,
      `Skill ${fixture.runId}`
    )
    const { teamMemberId } = await createTeamMember(
      fixture.db,
      fixture.tenantId,
      teamId,
      fixture.ownerPersonId
    )
    await assignTeamMemberSkill(
      fixture.db,
      fixture.tenantId,
      teamMemberId,
      skillId
    )
    const { eventId } = await createEvent(
      fixture.db,
      fixture.tenantId,
      `Event ${fixture.runId}`,
      new Date()
    )
    const { slotId } = await createEventSlot(
      fixture.db,
      fixture.tenantId,
      eventId,
      teamId,
      skillId
    )

    const assignResponse = await eventAssignmentsRoutes.handle(
      makeJsonRequest('/rpc/event-assignments', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId,
        slotId,
        userId: fixture.ownerPersonId,
      })
    )
    expect(assignResponse.status).toBe(200)
    const assignment = await readJson<{ id: number }>(assignResponse)
    expect(assignment.id).toBeDefined()

    const listResponse = await eventAssignmentsRoutes.handle(
      makeJsonRequest(`/rpc/event-assignments/${fixture.tenantId}/${eventId}`, fixture.ownerToken)
    )
    expect(listResponse.status).toBe(200)
    const assignments = await readJson<Array<{ id: number }>>(listResponse)
    expect(assignments.length).toBeGreaterThan(0)

    const deleteResponse = await eventAssignmentsRoutes.handle(
      makeJsonRequest('/rpc/event-assignments', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        assignmentId: assignment.id,
      })
    )
    expect(deleteResponse.status).toBe(200)
    const deleted = await readJson<{ success: boolean }>(deleteResponse)
    expect(deleted.success).toBe(true)

    const deleteMissing = await eventAssignmentsRoutes.handle(
      makeJsonRequest('/rpc/event-assignments', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        assignmentId: assignment.id,
      })
    )
    expect(deleteMissing.status).toBe(404)
  })

  test('rejects assignment when slot not found', async () => {
    const { eventId } = await createEvent(
      fixture.db,
      fixture.tenantId,
      `Event Slot NotFound ${fixture.runId}`,
      new Date()
    )

    const response = await eventAssignmentsRoutes.handle(
      makeJsonRequest('/rpc/event-assignments', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId,
        slotId: 999999,
        userId: fixture.ownerPersonId,
      })
    )
    expect(response.status).toBe(400)
  })

  test('rejects assignment when user not active in tenant', async () => {
    const { teamId } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team Inactive ${fixture.runId}`
    )
    const { skillId } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      teamId,
      `Skill Inactive ${fixture.runId}`
    )
    const { eventId } = await createEvent(
      fixture.db,
      fixture.tenantId,
      `Event Inactive ${fixture.runId}`,
      new Date()
    )
    const { slotId } = await createEventSlot(
      fixture.db,
      fixture.tenantId,
      eventId,
      teamId,
      skillId
    )

    // outsider is from another tenant
    const response = await eventAssignmentsRoutes.handle(
      makeJsonRequest('/rpc/event-assignments', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId,
        slotId,
        userId: fixture.outsiderPersonId,
      })
    )
    expect(response.status).toBe(400)
  })

  test('rejects assignment when user not member of team', async () => {
    // Make member an active user
    await fixture.db.insert(tenantUsers).values({ personId: fixture.memberPersonId }).onConflictDoNothing()

    const { teamId } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team NoMember ${fixture.runId}`
    )
    const { skillId } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      teamId,
      `Skill NoMember ${fixture.runId}`
    )
    const { eventId } = await createEvent(
      fixture.db,
      fixture.tenantId,
      `Event NoMember ${fixture.runId}`,
      new Date()
    )
    const { slotId } = await createEventSlot(
      fixture.db,
      fixture.tenantId,
      eventId,
      teamId,
      skillId
    )

    // member is active but not in this team
    const response = await eventAssignmentsRoutes.handle(
      makeJsonRequest('/rpc/event-assignments', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId,
        slotId,
        userId: fixture.memberPersonId,
      })
    )
    expect(response.status).toBe(400)
  })

  test('rejects assignment when user lacks required skill', async () => {
    const { teamId } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team NoSkill ${fixture.runId}`
    )
    const { skillId } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      teamId,
      `Skill NoSkill ${fixture.runId}`
    )
    // Add owner to team but without the skill
    await createTeamMember(
      fixture.db,
      fixture.tenantId,
      teamId,
      fixture.ownerPersonId
    )
    const { eventId } = await createEvent(
      fixture.db,
      fixture.tenantId,
      `Event NoSkill ${fixture.runId}`,
      new Date()
    )
    const { slotId } = await createEventSlot(
      fixture.db,
      fixture.tenantId,
      eventId,
      teamId,
      skillId
    )

    const response = await eventAssignmentsRoutes.handle(
      makeJsonRequest('/rpc/event-assignments', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId,
        slotId,
        userId: fixture.ownerPersonId,
      })
    )
    expect(response.status).toBe(400)
  })

  test('rejects assignment to different team in same event', async () => {
    // Create two teams
    const { teamId: team1Id } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team Multi1 ${fixture.runId}`
    )
    const { teamId: team2Id } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team Multi2 ${fixture.runId}`
    )
    const { skillId: skill1Id } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      team1Id,
      `Skill Multi1 ${fixture.runId}`
    )
    const { skillId: skill2Id } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      team2Id,
      `Skill Multi2 ${fixture.runId}`
    )

    // Add owner to both teams with skills
    const { teamMemberId: tm1 } = await createTeamMember(
      fixture.db,
      fixture.tenantId,
      team1Id,
      fixture.ownerPersonId
    )
    const { teamMemberId: tm2 } = await createTeamMember(
      fixture.db,
      fixture.tenantId,
      team2Id,
      fixture.ownerPersonId
    )
    await assignTeamMemberSkill(fixture.db, fixture.tenantId, tm1, skill1Id)
    await assignTeamMemberSkill(fixture.db, fixture.tenantId, tm2, skill2Id)

    const { eventId } = await createEvent(
      fixture.db,
      fixture.tenantId,
      `Event MultiTeam ${fixture.runId}`,
      new Date()
    )
    const { slotId: slot1Id } = await createEventSlot(
      fixture.db,
      fixture.tenantId,
      eventId,
      team1Id,
      skill1Id
    )
    const { slotId: slot2Id } = await createEventSlot(
      fixture.db,
      fixture.tenantId,
      eventId,
      team2Id,
      skill2Id
    )

    // First assignment succeeds
    const response1 = await eventAssignmentsRoutes.handle(
      makeJsonRequest('/rpc/event-assignments', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId,
        slotId: slot1Id,
        userId: fixture.ownerPersonId,
      })
    )
    expect(response1.status).toBe(200)

    // Second assignment to different team fails
    const response2 = await eventAssignmentsRoutes.handle(
      makeJsonRequest('/rpc/event-assignments', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId,
        slotId: slot2Id,
        userId: fixture.ownerPersonId,
      })
    )
    expect(response2.status).toBe(400)
  })

  test('rejects assignment with incompatible skills', async () => {
    const { teamId } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team Incompat ${fixture.runId}`
    )
    const { skillId: skillA } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      teamId,
      `Skill Incompat A ${fixture.runId}`
    )
    const { skillId: skillB } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      teamId,
      `Skill Incompat B ${fixture.runId}`
    )

    // Mark skills as incompatible
    const [id1, id2] = skillA < skillB ? [skillA, skillB] : [skillB, skillA]
    await fixture.db.insert(tenantSkillIncompatibility).values({
      tenantId: fixture.tenantId,
      skillId1: id1,
      skillId2: id2,
    })

    const { teamMemberId } = await createTeamMember(
      fixture.db,
      fixture.tenantId,
      teamId,
      fixture.ownerPersonId
    )
    await assignTeamMemberSkill(fixture.db, fixture.tenantId, teamMemberId, skillA)
    await assignTeamMemberSkill(fixture.db, fixture.tenantId, teamMemberId, skillB)

    const { eventId } = await createEvent(
      fixture.db,
      fixture.tenantId,
      `Event Incompat ${fixture.runId}`,
      new Date()
    )
    const { slotId: slotA } = await createEventSlot(
      fixture.db,
      fixture.tenantId,
      eventId,
      teamId,
      skillA
    )
    const { slotId: slotB } = await createEventSlot(
      fixture.db,
      fixture.tenantId,
      eventId,
      teamId,
      skillB
    )

    // First assignment succeeds
    const response1 = await eventAssignmentsRoutes.handle(
      makeJsonRequest('/rpc/event-assignments', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId,
        slotId: slotA,
        userId: fixture.ownerPersonId,
      })
    )
    expect(response1.status).toBe(200)

    // Second assignment with incompatible skill fails
    const response2 = await eventAssignmentsRoutes.handle(
      makeJsonRequest('/rpc/event-assignments', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId,
        slotId: slotB,
        userId: fixture.ownerPersonId,
      })
    )
    expect(response2.status).toBe(400)
  })
})
