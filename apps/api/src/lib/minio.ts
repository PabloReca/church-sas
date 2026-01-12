import * as Minio from "minio";
import { config } from "@/config";

if (!config.minio) {
  console.warn("Missing MINIO_URL environment variable. File upload will not work.");
}

const minioClient = config.minio
  ? new Minio.Client({
      endPoint: config.minio.host,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    })
  : null;

function getClient() {
  if (!minioClient || !config.minio) {
    throw new Error("MinIO not configured");
  }
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
    console.log(`Created bucket: ${minio.bucket}`);
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
