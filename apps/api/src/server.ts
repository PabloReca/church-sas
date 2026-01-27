import { createServer } from 'http'
import { app } from '@/app'
import { config } from '@/config'
import { logger } from '@/lib/infra/logger'

const server = createServer((req, res) => {
  const url = `http://${req.headers.host}${req.url}`

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      const headerValue = Array.isArray(value) ? value[0] : value
      if (headerValue) {
        headers.set(key, headerValue)
      }
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', async () => {
      const body = Buffer.concat(chunks)
      const request = new Request(url, {
        method: req.method,
        headers,
        body: body || undefined,
      })

      try {
        const response = await app.fetch(request)
        res.statusCode = response.status
        response.headers.forEach((value: string, key: string) => {
          res.setHeader(key, value)
        })
        const responseBody = await response.text()
        res.end(responseBody)
      } catch (error: unknown) {
        logger.error({ err: error }, 'Server error')
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
    })
  } else {
    const request = new Request(url, {
      method: req.method,
      headers,
    })

    ;(async () => {
      try {
        const response = await app.fetch(request)
        res.statusCode = response.status
        response.headers.forEach((value: string, key: string) => {
          res.setHeader(key, value)
        })
        const responseBody = await response.text()
        res.end(responseBody)
      } catch (error: unknown) {
        logger.error({ err: error }, 'Server error')
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
    })()
  }
})

server.listen(config.port, () => {
  console.log(`Church API is running at http://localhost:${config.port}`)
})

export { server }
