import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { outboxEvents, eq, type DbClient } from '@structpaper/db';

@Injectable()
export class OutboxDispatcherProcessor {
  private readonly logger = new Logger(OutboxDispatcherProcessor.name);

  constructor(
    @Inject('DB_CLIENT') private readonly db: DbClient,
    @Optional() @Inject('PG_BOSS') private readonly boss?: any,
  ) {}

  public async register(boss: any): Promise<void> {
    this.logger.log("Registering worker listener for queue 'outbox.dispatch'...");
    await boss.work('outbox.dispatch', async () => {
      await this.processPendingEvents();
    });
    this.logger.log("Worker listener for 'outbox.dispatch' successfully registered.");
  }

  public async processPendingEvents(batchSize: number = 50): Promise<number> {
    let pending: any[] = [];

    if (this.db.select) {
      pending = await this.db
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.status, 'PENDING'))
        .limit(batchSize);
    } else if (this.db.query?.outboxEvents?.findMany) {
      pending = await this.db.query.outboxEvents.findMany({
        where: eq(outboxEvents.status, 'PENDING'),
        limit: batchSize,
      });
    }

    if (!pending || pending.length === 0) {
      return 0;
    }

    this.logger.log(`Found ${pending.length} pending outbox events to dispatch.`);
    let processedCount = 0;

    for (const event of pending) {
      try {
        // Dispatch known events to background queues if boss is present
        if (this.boss) {
          if (event.eventType === 'compile.requested' || event.eventType === 'compile.latex') {
            await this.boss.send('compile.latex', event.payload);
          }
        }

        // Mark as PROCESSED
        await this.db
          .update(outboxEvents)
          .set({
            status: 'PROCESSED',
            processedAt: new Date(),
          })
          .where(eq(outboxEvents.id, event.id));

        processedCount++;
      } catch (err: any) {
        this.logger.error(
          `Failed to dispatch outbox event ${event.id} (${event.eventType}): ${err.message}`,
        );
        try {
          const nextRetry = (event.retryCount ?? 0) + 1;
          await this.db
            .update(outboxEvents)
            .set({
              retryCount: nextRetry,
              status: nextRetry >= 5 ? 'FAILED' : 'PENDING',
            })
            .where(eq(outboxEvents.id, event.id));
        } catch (dbErr: any) {
          this.logger.error(`Error updating retryCount for event ${event.id}: ${dbErr.message}`);
        }
      }
    }

    this.logger.log(`Successfully dispatched ${processedCount} outbox events.`);
    return processedCount;
  }
}
