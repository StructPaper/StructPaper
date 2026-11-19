import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import {
  manuscripts,
  manuscriptDocs,
  manuscriptOps,
  manuscriptRevisions,
  outboxEvents,
  eq,
  and,
  gt,
  desc,
  asc,
} from '@structpaper/db';
import type { SubmitOps } from '@structpaper/contracts';
import { PatchApplier } from '../domain/patch-applier';
import { SseManagerService } from '../domain/sse-manager.service';
import { subject, type AppAbility } from '../../access/domain/ability.factory';

export interface SubmitOpsResult {
  serverRev: number;
  checksum: string;
  opId: string;
}

@Injectable()
export class SyncService {
  constructor(
    @Optional()
    @Inject('DRIZZLE')
    private readonly db: any,
    @Inject(SseManagerService)
    private readonly sseManager: SseManagerService,
  ) {}

  /**
   * Applies operational transformation / patch list to a manuscript document tree atomically,
   * enforcing write ACL, verifying baseServerRev for 409 conflict rebase, maintaining idempotency,
   * writing checkpoints every 20 ops, and broadcasting updates via Fastify SSE.
   */
  async submitOps(
    manuscriptId: string,
    dto: SubmitOps,
    userId: string,
    userAbility?: AppAbility,
  ): Promise<SubmitOpsResult> {
    const manuscript = await this.findManuscriptById(manuscriptId);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${manuscriptId} not found`);
    }

    if (
      userAbility &&
      !userAbility.can('update', subject('Manuscript', manuscript)) &&
      !userAbility.can('manage', subject('Manuscript', manuscript))
    ) {
      throw new ForbiddenException('You do not have permission to modify this manuscript');
    }

    // 1. Idempotency Check: if this opId has already been applied, return 200 with recorded rev & checksum
    const existingOp = await this.findOpByOpId(dto.opId);
    if (existingOp) {
      return {
        serverRev: existingOp.serverRev,
        checksum: existingOp.checksum || '',
        opId: existingOp.opId,
      };
    }

    const currentServerRev = manuscript.currentServerRev ?? 0;

    // 2. Future rev check
    if (dto.baseServerRev > currentServerRev) {
      throw new BadRequestException(
        `Client baseServerRev (${dto.baseServerRev}) cannot be greater than current serverRev (${currentServerRev})`,
      );
    }

    // 3. 409 Conflict Check: if baseServerRev < currentServerRev, client must rebase
    if (dto.baseServerRev < currentServerRev) {
      const missingOps = await this.findMissingOps(manuscriptId, dto.baseServerRev);
      throw new ConflictException({
        code: 'OUT_OF_SYNC',
        message: `Client baseServerRev (${dto.baseServerRev}) is behind current serverRev (${currentServerRev}); rebase required`,
        serverRev: currentServerRev,
        missingOps,
      });
    }

    const nextServerRev = currentServerRev + 1;
    const now = new Date();

    // Retrieve current doc tree
    const docRecord = await this.findDocByManuscriptId(manuscriptId);
    const currentDocTree = docRecord?.docTree || { type: 'doc', content: [] };

    // Apply patches immutably and compute deterministic checksum
    const { docTree: nextDocTree, checksum: newChecksum } = PatchApplier.apply(
      currentDocTree,
      dto.patches,
    );

    const opRecord = {
      id: crypto.randomUUID(),
      manuscriptId,
      serverRev: nextServerRev,
      clientRev: dto.clientRev,
      opId: dto.opId,
      patches: dto.patches,
      checksum: newChecksum,
      createdBy: userId,
      createdAt: now,
    };

    const outboxRecord = {
      id: crypto.randomUUID(),
      aggregateType: 'MANUSCRIPT',
      aggregateId: manuscriptId,
      eventType: 'OP_APPLIED',
      payload: {
        opId: dto.opId,
        serverRev: nextServerRev,
        clientRev: dto.clientRev,
        checksum: newChecksum,
        createdBy: userId,
      },
      status: 'PENDING',
      retryCount: 0,
      createdAt: now,
    };

    const isCheckpoint = nextServerRev % 20 === 0;
    const checkpointRecord = isCheckpoint
      ? {
          id: crypto.randomUUID(),
          manuscriptId,
          serverRev: nextServerRev,
          tagName: `checkpoint-rev-${nextServerRev}`,
          kind: 'sync',
          snapshot: nextDocTree,
          checksum: newChecksum,
          createdBy: userId,
          createdAt: now,
        }
      : null;

    const executeTransaction = async (tx: any) => {
      // 1. Insert op log record
      await tx.insert(manuscriptOps).values(opRecord);

      // 2. Update doc tree and doc server rev
      if (docRecord) {
        await tx
          .update(manuscriptDocs)
          .set({
            docTree: nextDocTree,
            serverRev: nextServerRev,
            updatedAt: now,
          })
          .where(eq(manuscriptDocs.manuscriptId, manuscriptId));
      } else {
        await tx.insert(manuscriptDocs).values({
          manuscriptId,
          docTree: nextDocTree,
          serverRev: nextServerRev,
          updatedAt: now,
        });
      }

      // 3. Update manuscript currentServerRev
      await tx
        .update(manuscripts)
        .set({
          currentServerRev: nextServerRev,
          updatedAt: now,
        })
        .where(eq(manuscripts.id, manuscriptId));

      // 4. Emit outbox event
      await tx.insert(outboxEvents).values(outboxRecord);

      // 5. If checkpoint milestone (every 20 ops), save revision snapshot
      if (checkpointRecord) {
        await tx.insert(manuscriptRevisions).values(checkpointRecord);
      }
    };

    if (this.db) {
      if (typeof this.db.transaction === 'function') {
        await this.db.transaction(executeTransaction);
      } else {
        await executeTransaction(this.db);
      }
    }

    // Broadcast applied op to all active SSE listeners for this manuscript
    this.sseManager.broadcast(manuscriptId, 'op', {
      opId: dto.opId,
      serverRev: nextServerRev,
      clientRev: dto.clientRev,
      patches: dto.patches,
      checksum: newChecksum,
      createdBy: userId,
    });

    return {
      serverRev: nextServerRev,
      checksum: newChecksum,
      opId: dto.opId,
    };
  }

  /**
   * Creates a named milestone revision snapshot.
   */
  async createRevision(
    manuscriptId: string,
    tagName: string,
    userId: string,
    userAbility?: AppAbility,
  ): Promise<any> {
    const manuscript = await this.findManuscriptById(manuscriptId);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${manuscriptId} not found`);
    }

    if (
      userAbility &&
      !userAbility.can('update', subject('Manuscript', manuscript)) &&
      !userAbility.can('manage', subject('Manuscript', manuscript))
    ) {
      throw new ForbiddenException('You do not have permission to create revisions on this manuscript');
    }

    const docRecord = await this.findDocByManuscriptId(manuscriptId);
    const snapshot = docRecord?.docTree || { type: 'doc', content: [] };
    const checksum = PatchApplier.calculateChecksum(snapshot);
    const serverRev = manuscript.currentServerRev ?? docRecord?.serverRev ?? 0;

    const revisionRecord = {
      id: crypto.randomUUID(),
      manuscriptId,
      serverRev,
      tagName,
      kind: 'sync',
      snapshot,
      checksum,
      createdBy: userId,
      createdAt: new Date(),
    };

    if (this.db) {
      const inserted = await this.db.insert(manuscriptRevisions).values(revisionRecord).returning?.();
      const result = (inserted && inserted[0]) || revisionRecord;

      this.sseManager.broadcast(manuscriptId, 'revision', result);
      return result;
    }

    this.sseManager.broadcast(manuscriptId, 'revision', revisionRecord);
    return revisionRecord;
  }

  /**
   * Lists all historical revisions / milestones for a manuscript.
   */
  async listRevisions(manuscriptId: string, userAbility?: AppAbility): Promise<any[]> {
    const manuscript = await this.findManuscriptById(manuscriptId);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${manuscriptId} not found`);
    }

    if (
      userAbility &&
      !userAbility.can('read', subject('Manuscript', manuscript)) &&
      !userAbility.can('manage', subject('Manuscript', manuscript))
    ) {
      throw new ForbiddenException('You do not have permission to view revisions for this manuscript');
    }

    if (!this.db) return [];

    if (this.db.query?.manuscriptRevisions?.findMany) {
      return this.db.query.manuscriptRevisions.findMany({
        where: eq(manuscriptRevisions.manuscriptId, manuscriptId),
        orderBy: desc(manuscriptRevisions.serverRev),
      });
    }

    if (this.db.select) {
      return this.db
        .select()
        .from(manuscriptRevisions)
        .where(eq(manuscriptRevisions.manuscriptId, manuscriptId))
        .orderBy(desc(manuscriptRevisions.serverRev));
    }

    return [];
  }

  /**
   * Retrieves the current document tree and revision for a manuscript.
   */
  async getDoc(manuscriptId: string, userAbility?: AppAbility): Promise<any> {
    const manuscript = await this.findManuscriptById(manuscriptId);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${manuscriptId} not found`);
    }

    if (
      userAbility &&
      !userAbility.can('read', subject('Manuscript', manuscript)) &&
      !userAbility.can('manage', subject('Manuscript', manuscript))
    ) {
      throw new ForbiddenException('You do not have permission to view this manuscript');
    }

    const doc = await this.findDocByManuscriptId(manuscriptId);
    const docTree = doc?.docTree || { type: 'doc', content: [] };
    const serverRev = doc?.serverRev ?? manuscript.currentServerRev ?? 0;
    const checksum = PatchApplier.calculateChecksum(docTree);

    return {
      manuscriptId,
      docTree,
      serverRev,
      checksum,
    };
  }

  /**
   * Retrieves missing ops since a specified baseServerRev for 409 rebase reconciliation.
   */
  async getMissingOps(manuscriptId: string, sinceRev: number, userAbility?: AppAbility): Promise<any[]> {
    const manuscript = await this.findManuscriptById(manuscriptId);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${manuscriptId} not found`);
    }

    if (
      userAbility &&
      !userAbility.can('read', subject('Manuscript', manuscript)) &&
      !userAbility.can('manage', subject('Manuscript', manuscript))
    ) {
      throw new ForbiddenException('You do not have permission to read ops for this manuscript');
    }

    return this.findMissingOps(manuscriptId, sinceRev);
  }

  /**
   * Subscribes a client to SSE event stream for a manuscript.
   */
  async subscribeStream(
    manuscriptId: string,
    reply: any,
    req?: any,
    userAbility?: AppAbility,
  ): Promise<void> {
    const manuscript = await this.findManuscriptById(manuscriptId);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${manuscriptId} not found`);
    }

    if (
      userAbility &&
      !userAbility.can('read', subject('Manuscript', manuscript)) &&
      !userAbility.can('manage', subject('Manuscript', manuscript))
    ) {
      throw new ForbiddenException('You do not have permission to stream events for this manuscript');
    }

    this.sseManager.addClient(manuscriptId, reply, req);
  }

  private async findManuscriptById(id: string): Promise<any> {
    if (!this.db) return null;

    if (this.db.query?.manuscripts?.findFirst) {
      return this.db.query.manuscripts.findFirst({
        where: eq(manuscripts.id, id),
      });
    }

    if (this.db.select) {
      const rows = await this.db.select().from(manuscripts).where(eq(manuscripts.id, id)).limit(1);
      return rows[0] || null;
    }

    return null;
  }

  private async findDocByManuscriptId(manuscriptId: string): Promise<any> {
    if (!this.db) return null;

    if (this.db.query?.manuscriptDocs?.findFirst) {
      return this.db.query.manuscriptDocs.findFirst({
        where: eq(manuscriptDocs.manuscriptId, manuscriptId),
      });
    }

    if (this.db.select) {
      const rows = await this.db
        .select()
        .from(manuscriptDocs)
        .where(eq(manuscriptDocs.manuscriptId, manuscriptId))
        .limit(1);
      return rows[0] || null;
    }

    return null;
  }

  private async findOpByOpId(opId: string): Promise<any> {
    if (!this.db) return null;

    if (this.db.query?.manuscriptOps?.findFirst) {
      return this.db.query.manuscriptOps.findFirst({
        where: eq(manuscriptOps.opId, opId),
      });
    }

    if (this.db.select) {
      const rows = await this.db
        .select()
        .from(manuscriptOps)
        .where(eq(manuscriptOps.opId, opId))
        .limit(1);
      return rows[0] || null;
    }

    return null;
  }

  private async findMissingOps(manuscriptId: string, sinceRev: number): Promise<any[]> {
    if (!this.db) return [];

    if (this.db.query?.manuscriptOps?.findMany) {
      return this.db.query.manuscriptOps.findMany({
        where: and(
          eq(manuscriptOps.manuscriptId, manuscriptId),
          gt(manuscriptOps.serverRev, sinceRev),
        ),
        orderBy: asc(manuscriptOps.serverRev),
      });
    }

    if (this.db.select) {
      return this.db
        .select()
        .from(manuscriptOps)
        .where(
          and(
            eq(manuscriptOps.manuscriptId, manuscriptId),
            gt(manuscriptOps.serverRev, sinceRev),
          ),
        )
        .orderBy(asc(manuscriptOps.serverRev));
    }

    return [];
  }
}
