import { eq } from "drizzle-orm";
import { protectedProcedure, tenantProcedure, requireTenantUser } from "@/rpc/orpc";
import { emails, people, tenants, tenantHelpers, tenantPeopleFields, tenantPeopleFieldValues } from "@/db/schema";
import {
  listTenantPeopleInput,
} from "@/db/schemas-zod";

export const peopleTenantsRouter = {
  myTenants: protectedProcedure
    .route({ method: "GET", tags: ["People"], summary: "Get tenants for current person (primary + helpers)" })
    .handler(async ({ context }) => {
      const personId = context.user.userId;

      // Get primary tenant
      const [primaryPerson] = await context.db
        .select({
          tenantId: people.tenantId,
          tenantName: tenants.name,
          slug: tenants.slug,
          planId: tenants.planId,
          createdAt: tenants.createdAt,
        })
        .from(people)
        .innerJoin(tenants, eq(people.tenantId, tenants.id))
        .where(eq(people.id, personId))
        .limit(1);

      // Get helper tenants
      const helperTenantsList = await context.db
        .select({
          tenantId: tenantHelpers.tenantId,
          tenantName: tenants.name,
          slug: tenants.slug,
          planId: tenants.planId,
          createdAt: tenants.createdAt,
        })
        .from(tenantHelpers)
        .innerJoin(tenants, eq(tenantHelpers.tenantId, tenants.id))
        .where(eq(tenantHelpers.personId, personId));

      const result = [];

      if (primaryPerson) {
        result.push({ ...primaryPerson, isPrimary: true });
      }

      for (const helper of helperTenantsList) {
        result.push({ ...helper, isPrimary: false });
      }

      return result;
    }),

  listTenantPeople: tenantProcedure
    .route({ method: "GET", tags: ["People"], summary: "List people in a tenant (members + helpers)" })
    .input(listTenantPeopleInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      // Get people whose primary tenant is this one
      const primaryPeopleRaw = await context.db
        .select({
          id: people.id,
          tenantId: people.tenantId,
          role: people.role,
          email: emails.email,
          createdAt: people.createdAt,
        })
        .from(people)
        .innerJoin(emails, eq(people.emailId, emails.id))
        .where(eq(people.tenantId, input.tenantId));

      // Get helpers in this tenant
      const helperPeopleRaw = await context.db
        .select({
          id: people.id,
          tenantId: people.tenantId,
          role: people.role,
          email: emails.email,
          createdAt: people.createdAt,
        })
        .from(tenantHelpers)
        .innerJoin(people, eq(tenantHelpers.personId, people.id))
        .innerJoin(emails, eq(people.emailId, emails.id))
        .where(eq(tenantHelpers.tenantId, input.tenantId));

      // Get all field values for these people
      const allPersonIds = [
        ...primaryPeopleRaw.map(p => p.id),
        ...helperPeopleRaw.map(p => p.id),
      ];

      const allFieldValues = allPersonIds.length > 0
        ? await context.db
            .select({
              personId: tenantPeopleFieldValues.personId,
              fieldName: tenantPeopleFields.name,
              value: tenantPeopleFieldValues.value,
            })
            .from(tenantPeopleFieldValues)
            .innerJoin(tenantPeopleFields, eq(tenantPeopleFieldValues.fieldId, tenantPeopleFields.id))
            .where(eq(tenantPeopleFields.tenantId, input.tenantId))
        : [];

      // Group field values by person
      const fieldsByPerson = new Map<number, Record<string, string | null>>();
      for (const fv of allFieldValues) {
        if (!fieldsByPerson.has(fv.personId)) {
          fieldsByPerson.set(fv.personId, {});
        }
        fieldsByPerson.get(fv.personId)![fv.fieldName] = fv.value;
      }

      const result = [];

      for (const person of primaryPeopleRaw) {
        result.push({
          ...person,
          fields: fieldsByPerson.get(person.id) ?? {},
          isPrimary: true,
          isHelper: false,
        });
      }

      for (const person of helperPeopleRaw) {
        const existsAsPrimary = result.some(p => p.id === person.id);
        if (!existsAsPrimary) {
          result.push({
            ...person,
            fields: fieldsByPerson.get(person.id) ?? {},
            isPrimary: false,
            isHelper: true,
          });
        }
      }

      return result;
    }),
};
