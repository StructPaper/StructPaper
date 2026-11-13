export abstract class SseManagerService {
  /**
   * Registers a Fastify SSE client connection for a manuscript.
   */
  abstract addClient(manuscriptId: string, reply: any, req?: any): void;

  /**
   * Removes a Fastify SSE client connection.
   */
  abstract removeClient(manuscriptId: string, clientOrReply: any): void;

  /**
   * Broadcasts an SSE event to all connected listeners for a manuscript.
   */
  abstract broadcast(manuscriptId: string, event: string, data: any): void;

  /**
   * Returns current count of active connections for a manuscript.
   */
  abstract getConnectedCount(manuscriptId: string): number;
}
