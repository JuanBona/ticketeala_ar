// Private storage of receipt photos on an S3-compatible service (SeaweedFS, D17).
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';

/** SeaweedFS ignores the region, but the S3 client requires one. */
const S3_REGION = 'us-east-1';
const DEFAULT_S3_PORT = '8333';

export interface StorageSettings {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

/** Reads the storage settings from the environment; names the missing variable if one is absent. */
export function readStorageSettings(
  environment: NodeJS.ProcessEnv,
): StorageSettings {
  const required = (name: string): string => {
    const value = environment[name];
    if (!value) {
      throw new Error(
        `Falta ${name}: copiá apps/api/.env.example a apps/api/.env`,
      );
    }
    return value;
  };
  return {
    endpoint:
      environment.S3_ENDPOINT ??
      `http://localhost:${environment.S3_PORT ?? DEFAULT_S3_PORT}`,
    accessKey: required('S3_ACCESS_KEY'),
    secretKey: required('S3_SECRET_KEY'),
    bucket: required('S3_BUCKET'),
  };
}

@Injectable()
export class ReceiptImageStore {
  private connection: { client: S3Client; bucket: string } | undefined;

  /** Writes the photo under `key`. Fails loudly: the expense must not exist without its image. */
  async save(key: string, body: Buffer, contentType: string): Promise<void> {
    const { client, bucket } = this.connect();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  // Connects on first use, so the app (and tests that never upload) start without storage settings.
  private connect(): { client: S3Client; bucket: string } {
    if (!this.connection) {
      const settings = readStorageSettings(process.env);
      this.connection = {
        bucket: settings.bucket,
        client: new S3Client({
          endpoint: settings.endpoint,
          region: S3_REGION,
          // SeaweedFS serves buckets by path (host/bucket), not by subdomain.
          forcePathStyle: true,
          credentials: {
            accessKeyId: settings.accessKey,
            secretAccessKey: settings.secretKey,
          },
        }),
      };
    }
    return this.connection;
  }
}
