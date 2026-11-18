export interface StorageObjectMetadata {
  contentLength?: number;
  contentType?: string;
  etag?: string;
  lastModified?: Date;
}

export abstract class StorageService {
  /**
   * Generates a presigned PUT URL for direct client-to-storage uploads.
   */
  abstract getPresignedPutUrl(
    storageKey: string,
    mimeType: string,
    expiresInSeconds?: number,
  ): Promise<string>;

  /**
   * Retrieves object metadata (ContentLength, ContentType, ETag).
   * Returns null if object is not found.
   */
  abstract headObject(storageKey: string): Promise<StorageObjectMetadata | null>;

  /**
   * Retrieves the raw buffer of an uploaded object for checksum and magic byte validation.
   * Returns null if object is not found.
   */
  abstract getObjectBuffer(storageKey: string): Promise<Buffer | null>;

  /**
   * Stores a small object written by the API itself (e.g. the latest compiled PDF of a manuscript).
   */
  abstract putObject(storageKey: string, body: Buffer, mimeType: string): Promise<void>;

  /**
   * Deletes an object from storage.
   */
  abstract deleteObject(storageKey: string): Promise<void>;
}
