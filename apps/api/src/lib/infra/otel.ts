/**
 * OpenTelemetry SDK Initialization
 *
 * This file MUST be imported as the very first import in index.ts
 * It initializes auto-instrumentation for HTTP, Database, DNS, and other components
 */

// Load .env variables FIRST
import 'dotenv/config'

import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

// Only initialize if OTEL endpoint is configured
const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
const serviceName = process.env.OTEL_SERVICE_NAME || 'church-api'
const serviceVersion = process.env.OTEL_SERVICE_VERSION || '2.0.0'

if (otelEndpoint) {
  const resource = Resource.default().merge(
    new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      'service.instance.id': process.env.HOSTNAME || 'unknown',
      'deployment.environment': process.env.NODE_ENV || 'development',
    }),
  )

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({
      url: otelEndpoint,
      headers: {},
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Enable HTTP auto-instrumentation
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        // Enable PostgreSQL auto-instrumentation
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
          enhancedDatabaseReporting: true,
        },
        // Enable DNS auto-instrumentation
        '@opentelemetry/instrumentation-dns': {
          enabled: true,
        },
        // Disable filesystem to reduce noise
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        // Enable network instrumentation
        '@opentelemetry/instrumentation-net': {
          enabled: true,
        },
      }),
    ],
  })

  // Start the SDK
  sdk.start()

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => {
        console.log('OpenTelemetry SDK shutdown gracefully')
        process.exit(0)
      })
      .catch((err) => {
        console.error('Error shutting down OTEL SDK:', err)
        process.exit(1)
      })
  })

  console.log(`OpenTelemetry SDK initialized (endpoint: ${otelEndpoint})`)
} else {
  console.log('OTEL_EXPORTER_OTLP_ENDPOINT not set, OpenTelemetry disabled')
}
