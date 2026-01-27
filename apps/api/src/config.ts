import { env } from './env';

export const config = {
  port: env.PORT,

  database: {
    url: env.DATABASE_URL,
  },

  frontend: {
    url: env.FRONTEND_URL,
  },

  minio: {
    endpoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
    bucket: env.MINIO_BUCKET,
    useSSL: env.MINIO_USE_SSL,
  },

  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL,
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: '7d',
  },

  jwtSecret: env.JWT_SECRET,

  otel: {
    endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    serviceName: env.OTEL_SERVICE_NAME,
    serviceVersion: env.OTEL_SERVICE_VERSION,
  },

  isProduction: env.NODE_ENV === 'production',
}
