// Helper to get required env var
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Helper to get optional env var
function getOptionalEnv(name: string): string | undefined {
  return process.env[name];
}

// Parse MinIO URL: minio://accessKey:secretKey@host:port/bucket
function parseMinioUrl(url: string | undefined) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const useSSL = parsed.protocol === 'minios:';
    const bucket = parsed.pathname.replace(/^\//, '');

    return {
      endpoint: `${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}`,
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port) : (useSSL ? 443 : 9000),
      accessKey: decodeURIComponent(parsed.username),
      secretKey: decodeURIComponent(parsed.password),
      bucket,
      useSSL,
    };
  } catch {
    return null;
  }
}

const minioConfig = parseMinioUrl(getOptionalEnv('MINIO_URL'));

export const config = {
  port: parseInt(getRequiredEnv('PORT')),

  api: {
    url: getRequiredEnv('API_URL'),
  },

  database: {
    url: getRequiredEnv('DATABASE_URL'),
  },

  frontend: {
    url: getRequiredEnv('FRONTEND_URL'),
  },

  minio: minioConfig,

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

  isProduction: process.env.NODE_ENV === 'production',

  insecureHttp: getOptionalEnv('INSECURE_HTTP') === 'true',

  // Master admin email - created automatically on startup
  masterAdminEmail: getOptionalEnv('MASTER_ADMIN_EMAIL'),
}
