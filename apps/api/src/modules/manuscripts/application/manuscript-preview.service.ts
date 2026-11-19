import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { manuscripts, eq, and, isNull } from '@structpaper/db';
import { subject, type AppAbility } from '../../access/domain/ability.factory';
import { StorageService } from '../../assets/domain/storage.service';

const MAX_PREVIEW_BYTES = 64 * 1024 * 1024;

/**
 * The latest compiled PDF of a manuscript, kept on the server so that everybody who may READ the
 * paper (view-only members, guests with the link) can see the layout without being able to compile.
 * Written by whoever can edit the paper after a successful compile; read with the paper's read rule.
 */
@Injectable()
export class ManuscriptPreviewService {
  constructor(
    @Optional() @Inject('DRIZZLE') private readonly db: any,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  static keyFor(manuscriptId: string): string {
    return `previews/${manuscriptId}.pdf`;
  }

  async save(manuscriptId: string, body: unknown, ability?: AppAbility): Promise<{ success: boolean }> {
    const manuscript = await this.find(manuscriptId);
    if (ability && !ability.can('update', subject('Manuscript', manuscript))) {
      throw new ForbiddenException('You do not have permission to update this manuscript');
    }
    const buffer = Buffer.isBuffer(body) ? body : null;
    if (!buffer || buffer.length === 0 || buffer.length > MAX_PREVIEW_BYTES || buffer.subarray(0, 5).toString() !== '%PDF-') {
      throw new BadRequestException('The preview must be a PDF file');
    }
    await this.storage.putObject(ManuscriptPreviewService.keyFor(manuscriptId), buffer, 'application/pdf');
    return { success: true };
  }

  async read(manuscriptId: string, ability?: AppAbility): Promise<Buffer> {
    const manuscript = await this.find(manuscriptId);
    if (ability && !ability.can('read', subject('Manuscript', manuscript))) {
      throw new ForbiddenException('You do not have permission to view this manuscript');
    }
    const buffer = await this.storage.getObjectBuffer(ManuscriptPreviewService.keyFor(manuscriptId));
    if (!buffer) throw new NotFoundException('This manuscript has no preview yet');
    return buffer;
  }

  private async find(id: string) {
    const [row] = await this.db.select().from(manuscripts).where(and(eq(manuscripts.id, id), isNull(manuscripts.deletedAt))).limit(1);
    if (!row) throw new NotFoundException(`Manuscript with ID ${id} not found`);
    return row;
  }
}
