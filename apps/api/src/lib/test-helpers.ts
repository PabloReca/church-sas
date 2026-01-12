import { call } from "@orpc/server";
import type { Database } from "@/db/connection";

/**
 * Test context builder for creating mock user contexts
 */
export class TestContext {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  asUser(userId: number, email = "test@test.com", name = "Test User") {
    return new ContextBuilder(this.db, userId, email, name);
  }
}

class ContextBuilder {
  private userId: number;
  private email: string;
  private name: string;
  private isAdmin: boolean;
  private tenantId: number;
  private isTenantAdmin: boolean;
  private db: Database;

  constructor(db: Database, userId: number, email: string, name: string) {
    this.db = db;
    this.userId = userId;
    this.email = email;
    this.name = name;
    this.isAdmin = false;
    this.tenantId = 0;
    this.isTenantAdmin = false;
  }

  asAdmin() {
    this.isAdmin = true;
    return this;
  }

  inTenant(tenantId: number) {
    this.tenantId = tenantId;
    return this;
  }

  asTenantAdmin() {
    this.isTenantAdmin = true;
    return this;
  }

  asTenantOwner() {
    this.isTenantAdmin = true; // Owner is also admin
    return this;
  }

  build() {
    return {
      context: {
        db: this.db,
        user: {
          userId: this.userId,
          email: this.email,
          name: this.name,
          isAdmin: this.isAdmin,
          tenantId: this.tenantId,
          isTenantAdmin: this.isTenantAdmin,
        },
        req: new Request("http://localhost"),
      },
    };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Helper to call a procedure with a simpler API.
 * The procedure type inference relies on oRPC's internal types which are complex,
 * so we use 'any' for the procedure parameter and let the result be inferred at call site.
 */
export function callAs<TResult = any>(
  procedure: any,
  input: any,
  contextBuilder: ContextBuilder
): Promise<TResult> {
  return call(procedure, input, contextBuilder.build()) as Promise<TResult>;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
