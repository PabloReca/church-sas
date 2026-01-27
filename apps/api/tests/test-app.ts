import { Elysia, type AnyElysia } from 'elysia'
import { handleHttpError } from '@/lib/http-errors'

export const createTestApp = (...routes: AnyElysia[]) => {
  const app = new Elysia().onError(handleHttpError)

  for (const route of routes) {
    app.use(route)
  }

  return app
}
