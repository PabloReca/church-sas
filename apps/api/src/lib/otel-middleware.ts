import type { Context, Next } from 'hono'
import { trace, SpanStatusCode } from '@opentelemetry/api'

// Get tracer from the global tracer provider
function getTracer() {
  return trace.getTracer('church-api', '1.0.0')
}

/**
 * Hono middleware to create spans for each HTTP request
 * This provides manual instrumentation since auto-instrumentation doesn't work well with Bun
 */
export async function otelMiddleware(c: Context, next: Next) {
  const method = c.req.method
  const path = c.req.path
  const spanName = `${method} ${path}`

  const tracer = getTracer()

  return tracer.startActiveSpan(spanName, async (span) => {
    const startTime = Date.now()

    try {
      // Set span attributes with standard semantic conventions
      span.setAttributes({
        'http.method': method,
        'http.url': path,
        'http.route': path,
        'http.scheme': 'http',
        'http.target': c.req.url,
        // Add user agent if available
        'http.user_agent': c.req.header('user-agent') || 'unknown',
      })

      // Execute the request
      await next()

      // Set response attributes
      const status = c.res.status
      const duration = Date.now() - startTime

      span.setAttributes({
        'http.status_code': status,
        'http.response.status_code': status, // Alternative attribute name for better visibility
        'http.response_content_length': c.res.headers.get('content-length') || 0,
        'duration_ms': duration,
      })

      // Mark span as error if status >= 400
      if (status >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${status}`,
        })
      } else {
        span.setStatus({ code: SpanStatusCode.OK })
      }
    } catch (error) {
      // Record exception with full details
      span.recordException(error as Error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      })

      // Add error attributes
      span.setAttributes({
        'error': true,
        'error.type': (error as Error).name,
        'error.message': (error as Error).message,
      })

      throw error
    } finally {
      span.end()
    }
  })
}
