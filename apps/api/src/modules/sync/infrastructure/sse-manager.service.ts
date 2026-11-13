import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { SseManagerService } from '../domain/sse-manager.service';

interface ConnectedClient {
  id: string;
  reply: any;
  raw: any;
  manuscriptId: string;
}

@Injectable()
export class FastifySseManagerService extends SseManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(FastifySseManagerService.name);
  private readonly clients = new Map<string, Set<ConnectedClient>>();
  private pingInterval?: NodeJS.Timeout;

  constructor() {
    super();
    // Keep-alive heartbeat ping every 15 seconds
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 15000);
    if (this.pingInterval.unref) {
      this.pingInterval.unref();
    }
  }

  /**
   * Registers a Fastify SSE client connection for a manuscript.
   */
  addClient(manuscriptId: string, reply: any, req?: any): void {
    const raw = reply?.raw || reply;

    if (typeof reply?.hijack === 'function') {
      try {
        reply.hijack();
      } catch {
        // Safe fallback if already hijacked
      }
    }

    if (raw && typeof raw.writeHead === 'function' && !raw.headersSent) {
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
    }

    if (raw && typeof raw.write === 'function') {
      raw.write(': connected\n\n');
    }

    const client: ConnectedClient = {
      id: crypto.randomUUID(),
      reply,
      raw,
      manuscriptId,
    };

    if (!this.clients.has(manuscriptId)) {
      this.clients.set(manuscriptId, new Set());
    }
    this.clients.get(manuscriptId)!.add(client);

    const cleanup = () => {
      this.removeClient(manuscriptId, client);
    };

    if (raw && typeof raw.on === 'function') {
      raw.on('close', cleanup);
      raw.on('finish', cleanup);
      raw.on('error', cleanup);
    }

    if (req?.raw && typeof req.raw.on === 'function') {
      req.raw.on('close', cleanup);
    }
  }

  /**
   * Removes a Fastify SSE client connection.
   */
  removeClient(manuscriptId: string, clientOrReply: any): void {
    const group = this.clients.get(manuscriptId);
    if (!group) return;

    for (const client of group) {
      if (
        client === clientOrReply ||
        client.reply === clientOrReply ||
        client.raw === clientOrReply ||
        (clientOrReply && clientOrReply.id && client.id === clientOrReply.id)
      ) {
        group.delete(client);
        break;
      }
    }

    if (group.size === 0) {
      this.clients.delete(manuscriptId);
    }
  }

  /**
   * Broadcasts an SSE event to all connected listeners for a manuscript.
   */
  broadcast(manuscriptId: string, event: string, data: any): void {
    const group = this.clients.get(manuscriptId);
    if (!group || group.size === 0) return;

    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const message = `event: ${event}\ndata: ${payload}\n\n`;

    for (const client of group) {
      try {
        if (client.raw && typeof client.raw.write === 'function') {
          client.raw.write(message);
        }
      } catch (err) {
        this.logger.warn(`Failed to write to SSE client ${client.id}: ${(err as Error).message}`);
        this.removeClient(manuscriptId, client);
      }
    }
  }

  /**
   * Returns current count of active connections for a manuscript.
   */
  getConnectedCount(manuscriptId: string): number {
    return this.clients.get(manuscriptId)?.size ?? 0;
  }

  /**
   * Sends keep-alive ping to active SSE clients.
   */
  sendPing(manuscriptId?: string): void {
    const message = ': ping\n\n';
    if (manuscriptId) {
      const group = this.clients.get(manuscriptId);
      if (group) {
        for (const client of group) {
          try {
            client.raw?.write?.(message);
          } catch {
            this.removeClient(manuscriptId, client);
          }
        }
      }
      return;
    }

    for (const [mId, group] of this.clients.entries()) {
      for (const client of group) {
        try {
          client.raw?.write?.(message);
        } catch {
          this.removeClient(mId, client);
        }
      }
    }
  }

  onModuleDestroy(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }

    for (const [, group] of this.clients.entries()) {
      for (const client of group) {
        try {
          if (client.raw && typeof client.raw.end === 'function') {
            client.raw.end();
          }
        } catch {
          // ignore cleanup errors
        }
      }
    }
    this.clients.clear();
  }
}

export { FastifySseManagerService as SseManagerServiceImplementation };
