import { os } from "@orpc/server";
import type { Context } from "../context";

import { z } from "zod";

export const testRouter = {
  hello: os
    .$context<Context>()
    .handler(async ({ context }) => {
      return {
        message: "Hello from test",
        userId: context.user?.userId
      };
    }),

  add: os
    .$context<Context>()
    .input(z.object({
      a: z.number(),
      b: z.number(),
    }))
    .handler(async ({ input }) => {
      return { result: input.a + input.b };
    }),
};
