import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { manuscripts, eq, and, isNull } from '@structpaper/db';
import { subject, type AppAbility } from '../../access/domain/ability.factory';
import { StorageService } from '../../assets/domain/storage.service';

const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_BASELINE_BYTES = 32 * 1024 * 1024;
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface ManuscriptSourceInfo {
  fileName: string;
  sha256: string;
  size: number;
  uploadedAt: string;
  /** Version of the Word importer that made the stored first reading. */
  importerVersion: number;
  hasBaseline: boolean;
}

interface StoredMeta extends Omit<ManuscriptSourceInfo, 'hasBaseline'> {
  uploadedBy?: string;
}

/**
 * The Word file a paper was imported from, kept as it was uploaded, together with the importer version and the first
 * reading (the paper JSON the importer made of it) so that the file can be read again later and the result compared with the
 * paper as the author edited it. Kept apart from the paper itself (`manuscripts.metadata`), which the author's saves replace.
 *
 * Content is addressed by SHA-256 (verified here against what the client computed); permissions are the paper's: whoever can
 * read the paper can read the file, whoever can edit it can replace it.
 */
@Injectable()
export class ManuscriptSourceService {
  constructor(
    @Optional() @Inject('DRIZZLE') private readonly db: any,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  static fileKey = (id: string) => `sources/${id}/source.docx`;
  static metaKey = (id: string) => `sources/${id}/meta.json`;
  static baselineKey = (id: string) => `sources/${id}/baseline.json`;

  /** Stores (or replaces) the Word file. The client sends the matching first reading right after. */
  async saveFile(
    manuscriptId: string,
    body: unknown,
    input: { fileName?: string; sha256?: string; importerVersion?: number },
    ability?: AppAbility,
    userId?: string,
  ): Promise<ManuscriptSourceInfo> {
    const manuscript = await this.find(manuscriptId);
    if (ability && !ability.can('update', subject('Manuscript', manuscript))) {
      throw new ForbiddenException('You do not have permission to update this manuscript');
    }
    const buffer = Buffer.isBuffer(body) ? body : null;
    // a .docx is a zip file
    if (!buffer || buffer.length === 0 || buffer.length > MAX_SOURCE_BYTES || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new BadRequestException('The source must be a Word .docx file');
    }
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    if (input.sha256 && input.sha256.toLowerCase() !== sha256) {
      throw new BadRequestException('Checksum mismatch: the uploaded file is not the one that was hashed');
    }
    const importerVersion = Number(input.importerVersion);
    if (!Number.isInteger(importerVersion) || importerVersion < 0) {
      throw new BadRequestException('importerVersion must be a non-negative integer');
    }
    const fileName = (input.fileName || 'document.docx').replace(/[\r\n]/g, ' ').slice(0, 255);

    await this.storage.putObject(ManuscriptSourceService.fileKey(manuscriptId), buffer, DOCX_MIME);
    const meta: StoredMeta = { fileName, sha256, size: buffer.length, uploadedAt: new Date().toISOString(), importerVersion, uploadedBy: userId };
    await this.storage.putObject(ManuscriptSourceService.metaKey(manuscriptId), Buffer.from(JSON.stringify(meta)), 'application/json');
    return { ...this.publicMeta(meta), hasBaseline: await this.hasBaseline(manuscriptId) };
  }

  /** Replaces the first reading (and the importer version it was made with). */
  async saveBaseline(
    manuscriptId: string,
    body: unknown,
    importerVersion: number | undefined,
    ability?: AppAbility,
  ): Promise<ManuscriptSourceInfo> {
    const manuscript = await this.find(manuscriptId);
    if (ability && !ability.can('update', subject('Manuscript', manuscript))) {
      throw new ForbiddenException('You do not have permission to update this manuscript');
    }
    const meta = await this.readMeta(manuscriptId);
    if (!meta) throw new NotFoundException('This manuscript has no Word file yet');
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray((body as any).sections)) {
      throw new BadRequestException('The first reading must be a paper (an object with sections)');
    }
    const json = Buffer.from(JSON.stringify(body));
    if (json.length > MAX_BASELINE_BYTES) throw new BadRequestException('The first reading is too large');
    await this.storage.putObject(ManuscriptSourceService.baselineKey(manuscriptId), json, 'application/json');
    if (importerVersion !== undefined) {
      if (!Number.isInteger(importerVersion) || importerVersion < 0) throw new BadRequestException('importerVersion must be a non-negative integer');
      meta.importerVersion = importerVersion;
      await this.storage.putObject(ManuscriptSourceService.metaKey(manuscriptId), Buffer.from(JSON.stringify(meta)), 'application/json');
    }
    return { ...this.publicMeta(meta), hasBaseline: true };
  }

  async info(manuscriptId: string, ability?: AppAbility): Promise<ManuscriptSourceInfo | null> {
    await this.assertCanRead(manuscriptId, ability);
    const meta = await this.readMeta(manuscriptId);
    if (!meta) return null;
    return { ...this.publicMeta(meta), hasBaseline: await this.hasBaseline(manuscriptId) };
  }

  async readFile(manuscriptId: string, ability?: AppAbility): Promise<{ buffer: Buffer; fileName: string }> {
    await this.assertCanRead(manuscriptId, ability);
    const meta = await this.readMeta(manuscriptId);
    const buffer = meta ? await this.storage.getObjectBuffer(ManuscriptSourceService.fileKey(manuscriptId)) : null;
    if (!meta || !buffer) throw new NotFoundException('This manuscript has no Word file yet');
    return { buffer, fileName: meta.fileName };
  }

  async readBaseline(manuscriptId: string, ability?: AppAbility): Promise<unknown> {
    await this.assertCanRead(manuscriptId, ability);
    const buffer = await this.storage.getObjectBuffer(ManuscriptSourceService.baselineKey(manuscriptId));
    if (!buffer) throw new NotFoundException('This manuscript has no first reading of its Word file');
    return JSON.parse(buffer.toString('utf8'));
  }

  private publicMeta(meta: StoredMeta) {
    const { uploadedBy: _ignored, ...rest } = meta;
    return rest;
  }

  private async readMeta(id: string): Promise<StoredMeta | null> {
    const buffer = await this.storage.getObjectBuffer(ManuscriptSourceService.metaKey(id));
    if (!buffer) return null;
    try {
      return JSON.parse(buffer.toString('utf8')) as StoredMeta;
    } catch {
      return null;
    }
  }

  private async hasBaseline(id: string): Promise<boolean> {
    return !!(await this.storage.headObject(ManuscriptSourceService.baselineKey(id)));
  }

  private async assertCanRead(id: string, ability?: AppAbility) {
    const manuscript = await this.find(id);
    if (ability && !ability.can('read', subject('Manuscript', manuscript))) {
      throw new ForbiddenException('You do not have permission to view this manuscript');
    }
  }

  private async find(id: string) {
    const [row] = await this.db.select().from(manuscripts).where(and(eq(manuscripts.id, id), isNull(manuscripts.deletedAt))).limit(1);
    if (!row) throw new NotFoundException(`Manuscript with ID ${id} not found`);
    return row;
  }
}
