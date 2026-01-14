import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { MeterProvider } from '@opentelemetry/sdk-metrics'
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'

let tracerProvider: NodeTracerProvider | null = null
let meterProvider: MeterProvider | null = null

/**
 * Initialize OpenTelemetry instrumentation
 * Only initializes if OTEL_EXPORTER_OTLP_ENDPOINT is configured
 *
 * This function should be called BEFORE any other imports to ensure
 * auto-instrumentation can properly hook into modules
 */
export function initializeOTel(): void {
  // Check if OpenTelemetry is configured
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

  if (!endpoint) {
    // OTEL not configured, skip initialization
    console.log('OpenTelemetry not configured (OTEL_EXPORTER_OTLP_ENDPOINT not set). Running without telemetry.')
    return
  }

  try {
    // Enable diagnostic logging for debugging (set to ERROR in production)
    const logLevel = process.env.NODE_ENV === 'production' ? DiagLogLevel.ERROR : DiagLogLevel.INFO
    diag.setLogger(new DiagConsoleLogger(), logLevel)

    const serviceName = process.env.OTEL_SERVICE_NAME || 'church-api'
    const serviceVersion = process.env.OTEL_SERVICE_VERSION || '2.0.0'

    // Create resource with service information
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
    })

    // Configure trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    })

    // Create and configure tracer provider
    tracerProvider = new NodeTracerProvider({
      resource,
    })

    // Use BatchSpanProcessor for better performance
    // Configure with shorter timeouts to ensure spans are exported more frequently
    tracerProvider.addSpanProcessor(new BatchSpanProcessor(traceExporter, {
      // Export spans every 5 seconds (default is 5000ms but being explicit)
      scheduledDelayMillis: 5000,
      // Maximum queue size before forcing an export (default is 2048)
      maxQueueSize: 2048,
      // Maximum batch size per export (default is 512)
      maxExportBatchSize: 512,
      // Timeout for export operation (default is 30000ms)
      exportTimeoutMillis: 30000,
    }))

    // Register the tracer provider globally
    tracerProvider.register()

    console.log(`OpenTelemetry traces initialized. Service: ${serviceName}, Endpoint: ${endpoint}`)

    // Configure metrics exporter
    const metricExporter = new OTLPMetricExporter({
      url: `${endpoint}/v1/metrics`,
    })

    // Create metric reader with periodic export (every 60 seconds)
    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 60000, // 60 seconds
    })

    // Create and configure meter provider
    meterProvider = new MeterProvider({
      resource,
      readers: [metricReader],
    })

    console.log(`OpenTelemetry metrics initialized. Service: ${serviceName}`)

    // Handle graceful shutdown
    const shutdown = async () => {
      try {
        console.log('Shutting down OpenTelemetry...')
        // Force flush before shutdown to export any pending spans
        await tracerProvider?.forceFlush()
        await tracerProvider?.shutdown()
        await meterProvider?.shutdown()
        console.log('OpenTelemetry shut down successfully')
        process.exit(0)
      } catch (error) {
        console.error('Error shutting down OpenTelemetry:', error)
        process.exit(1)
      }
    }

    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)

    // Also handle uncaught exceptions to ensure traces are exported
    process.on('beforeExit', async () => {
      try {
        await tracerProvider?.forceFlush()
      } catch (error) {
        console.error('Error flushing OpenTelemetry on exit:', error)
      }
    })

  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error)
    // Don't crash the application if OTEL fails to initialize
  }
}

/**
 * Gracefully shutdown OpenTelemetry
 * Flushes any pending telemetry data
 */
export async function shutdownOTel(): Promise<void> {
  try {
    await tracerProvider?.shutdown()
    await meterProvider?.shutdown()
    console.log('OpenTelemetry shut down successfully')
  } catch (error) {
    console.error('Error shutting down OpenTelemetry:', error)
  }
}
