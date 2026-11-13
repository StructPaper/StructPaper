import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService, type StorageObjectMetadata } from '../domain/storage.service';

@Injectable()
export class S3StorageService extends StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    super();
    const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
    this.bucket = process.env.S3_BUCKET || 'structpaper-assets';
    const accessKeyId = process.env.S3_ACCESS_KEY || 'minioadmin';
    const secretAccessKey = process.env.S3_SECRET_KEY || 'minioadmin';
    const region = process.env.S3_REGION || 'us-east-1';

    this.client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async getPresignedPutUrl(
    storageKey: string,
    mimeType: string,
    expiresInSeconds: number = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: mimeType,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async headObject(storageKey: string): Promise<StorageObjectMetadata | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        }),
      );

      return {
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        etag: response.ETag,
        lastModified: response.LastModified,
      };
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.name === 'NoSuchKey' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      this.logger.error(`Failed to head object: ${storageKey}`, error);
      throw error;
    }
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        }),
      );

      if (!response.Body) {
        return null;
      }

      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (error: any) {
      if (
        error.name === 'NoSuchKey' ||
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      this.logger.error(`Failed to get object buffer: ${storageKey}`, error);
      throw error;
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        }),
      );
    } catch (error: any) {
      this.logger.error(`Failed to delete object: ${storageKey}`, error);
      throw error;
    }
  }
}
