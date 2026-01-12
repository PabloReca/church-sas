import { parse } from "cookie";
import { getDb } from "@/db/connection";
import { verifyJWT, type UserPayload } from "@/lib/jwt";
import type { Context as HonoContext } from "hono";

export async function createContext(c: HonoContext) {
  const db = getDb();

  // Extract user from JWT cookie
  let user: UserPayload | null = null;
  const cookieHeader = c.req.header("cookie");
  const cookies = parse(cookieHeader || "");
  const token = cookies.auth_token;

  if (token) {
    try {
      user = await verifyJWT(token);
    } catch {
      // Invalid token - user stays null
    }
  }

  return {
    db,
    user,
    req: c.req.raw,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
