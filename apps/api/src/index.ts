import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.json({ message: 'Hello from Hono.js!!' }))

export default {
  port: 8000,
  fetch: app.fetch,
}