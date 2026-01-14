import pino from 'pino'
import { trace, context } from '@opentelemetry/api'

const isDevelopment = process.env.NODE_ENV !== 'production'
const logLevel = (process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info')).toLowerCase()
const lokiEndpoint = process.env.LOKI_ENDPOINT // e.g., http://localhost:3100

// Mixin to automatically add OpenTelemetry trace context to all logs
const otelMixin = () => {
  const span = trace.getSpan(context.active())
  if (!span) {
    return {}
  }

  const spanContext = span.spanContext()
  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
    trace_flags: spanContext.traceFlags,
  }
}

// Development configuration: pretty printing with colors + optional Loki
const developmentConfig: pino.LoggerOptions = {
  level: logLevel,
  mixin: otelMixin,
  base: {
    service: 'church-api',
    environment: 'development',
  },
  transport: lokiEndpoint ? {
    targets: [
      // Pretty print to console
      {
        target: 'pino-pretty',
        level: logLevel,
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
      // Send to Loki via HTTP
      {
        target: 'pino-loki',
        level: logLevel,
        options: {
          batching: true,
          interval: 5,
          host: lokiEndpoint,
          labels: {
            application: 'church-api',
            environment: 'development',
          },
        },
      },
    ],
  } : {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: false,
    },
  },
}

// Production configuration: JSON output for Loki/Alloy
const productionConfig: pino.LoggerOptions = {
  level: logLevel,
  mixin: otelMixin,
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Output JSON that can be collected by Docker logging driver or sent to Loki
  base: {
    service: 'church-api',
    environment: process.env.NODE_ENV || 'production',
  },
}

export const logger = pino(isDevelopment ? developmentConfig : productionConfig)

// Helper function to create child loggers with context
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context)
}
