import * as Minio from "minio";
import { config } from "@/config";
import { logger } from "@/lib/logger";

const minioClient = new Minio.Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

function getClient() {
  return { client: minioClient, config: config.minio };
}

export async function ensureBucket() {
  const { client, config: minio } = getClient();

  const bucketExists = await client.bucketExists(minio.bucket);
  if (!bucketExists) {
    await client.makeBucket(minio.bucket);
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${minio.bucket}/*`],
        },
      ],
    };
    await client.setBucketPolicy(minio.bucket, JSON.stringify(policy));
    logger.info({ bucket: minio.bucket }, 'Created bucket');
  }
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const { client, config: minio } = getClient();

  await client.putObject(minio.bucket, filename, buffer, buffer.length, {
    "Content-Type": contentType,
  });

  const protocol = minio.useSSL ? "https" : "http";
  return `${protocol}://${minio.endpoint}/${minio.bucket}/${filename}`;
}

export async function deleteFile(filename: string): Promise<void> {
  const { client, config: minio } = getClient();
  await client.removeObject(minio.bucket, filename);
}
