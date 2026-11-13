import {
  Injectable,
  Inject,
  Optional,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { assets, eq } from '@structpaper/db';
import type {
  UploadIntent,
  UploadIntentResponse,
  UploadComplete,
  AssetResponse,
} from '@structpaper/contracts';
import { StorageService } from '../domain/storage.service';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/tiff',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'application/x-bibtex',
  'application/json',
  'application/zip',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

@Injectable()
export class AssetService {
  constructor(
    @Optional()
    @Inject('DRIZZLE')
    private readonly db: any,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Validates upload metadata and creates a presigned S3 PUT URL for direct MinIO upload.
   */
  async createUploadIntent(dto: UploadIntent, userId?: string): Promise<UploadIntentResponse> {
    if (!dto.mimeType || !ALLOWED_MIME_TYPES.has(dto.mimeType.toLowerCase())) {
      throw new BadRequestException(`Unsupported MIME type: ${dto.mimeType}`);
    }

    if (dto.fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    const cleanFilename = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folder = dto.manuscriptId ? `manuscripts/${dto.manuscriptId}` : 'uploads';
    const storageKey = `${folder}/${crypto.randomUUID()}-${cleanFilename}`;
    const expiresIn = 900; // 15 minutes

    const uploadUrl = await this.storageService.getPresignedPutUrl(
      storageKey,
      dto.mimeType,
      expiresIn,
    );

    return {
      uploadUrl,
      storageKey,
      expiresIn,
    };
  }

  /**
   * Completes the upload pipeline: verifies file presence in S3, checks size, SHA-256 and magic-bytes,
   * then inserts record into the assets table.
   */
  async completeUpload(dto: UploadComplete, userId?: string): Promise<AssetResponse> {
    const head = await this.storageService.headObject(dto.storageKey);
    if (!head) {
      throw new NotFoundException(`Uploaded file not found in storage: ${dto.storageKey}`);
    }

    if (head.contentLength !== undefined && dto.fileSize !== undefined) {
      if (head.contentLength !== dto.fileSize) {
        throw new BadRequestException(
          `File size mismatch: client claimed ${dto.fileSize} bytes, but storage holds ${head.contentLength} bytes`,
        );
      }
    }

    if (head.contentLength === 0) {
      throw new BadRequestException('Uploaded file is empty (0 bytes)');
    }

    // Retrieve object buffer to verify SHA-256 and magic bytes
    const buffer = await this.storageService.getObjectBuffer(dto.storageKey);
    if (buffer) {
      // 1. Verify SHA-256 checksum
      const computedChecksum = crypto.createHash('sha256').update(buffer).digest('hex');
      if (dto.checksum && computedChecksum !== dto.checksum.toLowerCase()) {
        throw new BadRequestException(
          `Checksum mismatch: computed SHA-256 (${computedChecksum}) does not match provided checksum (${dto.checksum})`,
        );
      }

      // 2. Validate magic bytes if MIME type is known
      const mime = (dto.mimeType || head.contentType || '').toLowerCase();
      this.validateMagicBytes(buffer, mime);
    }

    const filename = dto.filename || dto.storageKey.split('/').pop() || 'unknown';
    const mimeType = dto.mimeType || head.contentType || 'application/octet-stream';
    const fileSize = (head.contentLength !== undefined ? head.contentLength : dto.fileSize) || 0;

    const record = {
      id: crypto.randomUUID(),
      manuscriptId: dto.manuscriptId || null,
      filename,
      fileSize,
      mimeType,
      storageKey: dto.storageKey,
      checksum: dto.checksum,
      createdBy: userId || undefined,
      createdAt: new Date(),
    };

    if (this.db) {
      const inserted = await this.db.insert(assets).values(record).returning();
      return (inserted && inserted[0]) ? inserted[0] : record;
    }

    return record;
  }

  /**
   * Retrieves an asset record by ID.
   */
  async getAssetById(id: string): Promise<AssetResponse> {
    if (this.db) {
      if (this.db.query?.assets?.findFirst) {
        const found = await this.db.query.assets.findFirst({
          where: eq(assets.id, id),
        });
        if (found) return found;
      } else if (this.db.select) {
        const rows = await this.db.select().from(assets).where(eq(assets.id, id)).limit(1);
        if (rows && rows.length > 0) return rows[0];
      }
    }
    throw new NotFoundException(`Asset with ID ${id} not found`);
  }

  private validateMagicBytes(buffer: Buffer, mimeType: string): void {
    if (!buffer || buffer.length === 0 || !mimeType) return;

    if (mimeType === 'image/png') {
      const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      const matches = pngSignature.every((byte, idx) => buffer[idx] === byte);
      if (!matches) {
        throw new BadRequestException('File magic-bytes do not match declared MIME type (image/png)');
      }
    } else if (mimeType === 'image/jpeg') {
      if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
        throw new BadRequestException('File magic-bytes do not match declared MIME type (image/jpeg)');
      }
    } else if (mimeType === 'image/gif') {
      const isGif87 = buffer.subarray(0, 6).toString('ascii') === 'GIF87a';
      const isGif89 = buffer.subarray(0, 6).toString('ascii') === 'GIF89a';
      if (!isGif87 && !isGif89) {
        throw new BadRequestException('File magic-bytes do not match declared MIME type (image/gif)');
      }
    } else if (mimeType === 'application/pdf') {
      if (buffer.subarray(0, 4).toString('ascii') !== '%PDF') {
        throw new BadRequestException('File magic-bytes do not match declared MIME type (application/pdf)');
      }
    }
  }
}
