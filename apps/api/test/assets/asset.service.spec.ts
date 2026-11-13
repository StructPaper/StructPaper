import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { AssetService } from '../../src/modules/assets/application/asset.service';
import type { StorageService } from '../../src/modules/assets/domain/storage.service';
import type { UploadIntent, UploadComplete } from '@structpaper/contracts';

describe('Assets Presigned S3 Storage & Verification Flow (AssetService)', () => {
  let assetService: AssetService;
  let mockStorageService: StorageService;
  let mockDb: any;

  const userId = '11111111-1111-1111-1111-111111111111';
  const manuscriptId = '22222222-2222-2222-2222-222222222222';

  // Valid PNG file content: 8-byte PNG signature followed by dummy data
  const validPngBuffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('dummy-image-content-bytes'),
  ]);
  const validPngChecksum = crypto.createHash('sha256').update(validPngBuffer).digest('hex');

  beforeEach(() => {
    mockStorageService = {
      getPresignedPutUrl: vi.fn().mockImplementation(async (key: string, mimeType: string, expiresIn?: number) => {
        return `https://s3.example.com/structpaper-assets/${key}?presigned=true&expires=${expiresIn || 900}`;
      }),
      headObject: vi.fn().mockImplementation(async (key: string) => {
        return {
          contentLength: validPngBuffer.length,
          contentType: 'image/png',
          etag: '"mock-etag"',
          lastModified: new Date(),
        };
      }),
      getObjectBuffer: vi.fn().mockImplementation(async (key: string) => {
        return validPngBuffer;
      }),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    } as unknown as StorageService;

    const insertedRows: any[] = [];
    mockDb = {
      _data: { assets: insertedRows },
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((val: any) => ({
          returning: vi.fn().mockImplementation(async () => {
            const row = {
              ...val,
              id: val.id || 'asset-uuid-1',
              createdAt: val.createdAt || new Date(),
            };
            insertedRows.push(row);
            return [row];
          }),
        })),
      })),
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(async () => insertedRows),
          })),
        })),
      })),
      query: {
        assets: {
          findFirst: vi.fn().mockImplementation(async () => insertedRows[0] || null),
        },
      },
    };

    assetService = new AssetService(mockDb, mockStorageService);
  });

  describe('createUploadIntent', () => {
    it('generates valid Presigned PUT URL and storage key for allowed MIME type', async () => {
      const intentDto: UploadIntent = {
        filename: 'figure1.png',
        mimeType: 'image/png',
        fileSize: 1024 * 50,
        manuscriptId,
      };

      const result = await assetService.createUploadIntent(intentDto, userId);

      expect(result).toBeDefined();
      expect(result.uploadUrl).toContain('https://s3.example.com/structpaper-assets/');
      expect(result.uploadUrl).toContain('presigned=true');
      expect(result.storageKey).toContain(manuscriptId);
      expect(result.storageKey).toContain('figure1.png');
      expect(result.expiresIn).toBe(900);
      expect(mockStorageService.getPresignedPutUrl).toHaveBeenCalledWith(
        result.storageKey,
        'image/png',
        900,
      );
    });

    it('rejects unsupported or malicious MIME type with BadRequestException', async () => {
      const intentDto: UploadIntent = {
        filename: 'malicious.exe',
        mimeType: 'application/x-msdownload',
        fileSize: 1024,
        manuscriptId,
      };

      await expect(assetService.createUploadIntent(intentDto, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects file sizes exceeding maximum allowed limit (e.g. 50MB)', async () => {
      const intentDto: UploadIntent = {
        filename: 'huge_archive.zip',
        mimeType: 'application/octet-stream',
        fileSize: 100 * 1024 * 1024, // 100MB
        manuscriptId,
      };

      await expect(assetService.createUploadIntent(intentDto, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completeUpload', () => {
    it('verifies S3 headObject, checks SHA-256 and magic bytes, inserts into assets table', async () => {
      const completeDto: UploadComplete = {
        storageKey: `manuscripts/${manuscriptId}/figure1.png`,
        checksum: validPngChecksum,
        filename: 'figure1.png',
        mimeType: 'image/png',
        fileSize: validPngBuffer.length,
        manuscriptId,
      };

      const result = await assetService.completeUpload(completeDto, userId);

      expect(result).toBeDefined();
      expect(result.storageKey).toBe(completeDto.storageKey);
      expect(result.checksum).toBe(validPngChecksum);
      expect(result.filename).toBe('figure1.png');
      expect(result.fileSize).toBe(validPngBuffer.length);
      expect(result.mimeType).toBe('image/png');
      expect(mockStorageService.headObject).toHaveBeenCalledWith(completeDto.storageKey);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('rejects with NotFoundException when object does not exist in S3', async () => {
      (mockStorageService.headObject as any).mockResolvedValue(null);

      const completeDto: UploadComplete = {
        storageKey: `manuscripts/${manuscriptId}/missing.png`,
        checksum: validPngChecksum,
      };

      await expect(assetService.completeUpload(completeDto, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects with BadRequestException when client and storage file sizes mismatch', async () => {
      (mockStorageService.headObject as any).mockResolvedValue({
        contentLength: 9999, // Mismatched size
        contentType: 'image/png',
      });

      const completeDto: UploadComplete = {
        storageKey: `manuscripts/${manuscriptId}/figure1.png`,
        checksum: validPngChecksum,
        fileSize: validPngBuffer.length, // Different from 9999
      };

      await expect(assetService.completeUpload(completeDto, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects with BadRequestException when SHA-256 checksum does not match', async () => {
      const completeDto: UploadComplete = {
        storageKey: `manuscripts/${manuscriptId}/figure1.png`,
        checksum: 'invalid-sha256-hex-hash',
        filename: 'figure1.png',
        mimeType: 'image/png',
        fileSize: validPngBuffer.length,
      };

      await expect(assetService.completeUpload(completeDto, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects with BadRequestException when magic bytes do not match declared MIME type', async () => {
      // Buffer starting with text/ascii instead of PNG signature
      const fakePngBuffer = Buffer.from('Plain text fake image content');
      const fakeChecksum = crypto.createHash('sha256').update(fakePngBuffer).digest('hex');

      (mockStorageService.getObjectBuffer as any).mockResolvedValue(fakePngBuffer);
      (mockStorageService.headObject as any).mockResolvedValue({
        contentLength: fakePngBuffer.length,
        contentType: 'image/png',
      });

      const completeDto: UploadComplete = {
        storageKey: `manuscripts/${manuscriptId}/fake.png`,
        checksum: fakeChecksum,
        mimeType: 'image/png',
        fileSize: fakePngBuffer.length,
      };

      await expect(assetService.completeUpload(completeDto, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getAssetById', () => {
    it('returns asset when found in DB', async () => {
      const mockAsset = {
        id: 'asset-1',
        filename: 'diagram.png',
        fileSize: 1024,
        mimeType: 'image/png',
        storageKey: 'uploads/diagram.png',
        checksum: 'abc',
      };
      (mockDb.query.assets.findFirst as any).mockResolvedValue(mockAsset);

      const result = await assetService.getAssetById('asset-1');
      expect(result).toEqual(mockAsset);
    });

    it('throws NotFoundException when asset is not found', async () => {
      (mockDb.query.assets.findFirst as any).mockResolvedValue(null);

      await expect(assetService.getAssetById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
