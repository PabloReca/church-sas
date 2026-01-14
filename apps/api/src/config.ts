// Helper to get required env var
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Helper to get optional env var with default
function getEnvWithDefault(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  port: parseInt(getRequiredEnv('PORT')),

  database: {
    url: getRequiredEnv('DATABASE_URL'),
  },

  frontend: {
    url: getRequiredEnv('FRONTEND_URL'),
  },

  minio: {
    endpoint: getRequiredEnv('MINIO_ENDPOINT'),
    port: parseInt(getEnvWithDefault('MINIO_PORT', '9000')),
    accessKey: getRequiredEnv('MINIO_ACCESS_KEY'),
    secretKey: getRequiredEnv('MINIO_SECRET_KEY'),
    bucket: getRequiredEnv('MINIO_BUCKET'),
    useSSL: getEnvWithDefault('MINIO_USE_SSL', 'false') === 'true',
  },

  google: {
    clientId: getRequiredEnv('GOOGLE_CLIENT_ID'),
    clientSecret: getRequiredEnv('GOOGLE_CLIENT_SECRET'),
    callbackUrl: getRequiredEnv('GOOGLE_CALLBACK_URL'),
  },

  jwt: {
    secret: getRequiredEnv('JWT_SECRET'),
    expiresIn: '7d',
  },

  // Alias for convenience
  jwtSecret: getRequiredEnv('JWT_SECRET'),

  // OpenTelemetry (optional)
  otel: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT, // undefined if not set
    serviceName: getEnvWithDefault('OTEL_SERVICE_NAME', 'church-api'),
    serviceVersion: getEnvWithDefault('OTEL_SERVICE_VERSION', '2.0.0'),
  },

  isProduction: process.env.NODE_ENV === 'production',
}
