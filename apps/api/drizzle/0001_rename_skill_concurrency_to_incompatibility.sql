-- Rename tenant_skill_concurrency to tenant_skill_incompatibility
-- This changes from a whitelist (skills that CAN be used together) to a blacklist (skills that CANNOT be used together)

ALTER TABLE "customer"."tenant_skill_concurrency" RENAME TO "tenant_skill_incompatibility";

-- Rename indexes
ALTER INDEX "customer"."tenant_skill_concurrency_pk" RENAME TO "tenant_skill_incompatibility_pk";
ALTER INDEX "customer"."tenant_skill_concurrency_tenant_id_idx" RENAME TO "tenant_skill_incompatibility_tenant_id_idx";
ALTER INDEX "customer"."tenant_skill_concurrency_skill1_idx" RENAME TO "tenant_skill_incompatibility_skill1_idx";
ALTER INDEX "customer"."tenant_skill_concurrency_skill2_idx" RENAME TO "tenant_skill_incompatibility_skill2_idx";
