import * as Minio from "minio";
import { config } from "@/config";

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
