import {
  Controller,
  Get,
  Inject,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Public } from '../../access/presentation/decorators/public.decorator';

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  database: {
    status: 'ok' | 'degraded' | 'down' | 'unconfigured';
    error?: string;
  };
}

@Public()
@Controller('health')
export class HealthController {
  constructor(
    @Optional()
    @Inject('DB_CLIENT')
    private readonly dbClient?: any,
  ) {}

  @Get()
  async check(): Promise<HealthCheckResponse> {
    let dbStatus: 'ok' | 'degraded' | 'down' | 'unconfigured' = 'ok';
    let dbError: string | undefined;

    if (this.dbClient) {
      try {
        if (typeof this.dbClient.execute === 'function') {
          await this.dbClient.execute('SELECT 1');
        } else if (typeof this.dbClient === 'function') {
          await this.dbClient`SELECT 1`;
        }
      } catch (err) {
        dbStatus = 'down';
        dbError = err instanceof Error ? err.message : String(err);
      }
    } else if (process.env.DATABASE_URL) {
      dbStatus = 'down';
      dbError = 'Database client not initialized';
    } else {
      dbStatus = 'unconfigured';
    }

    const response: HealthCheckResponse = {
      status: dbStatus === 'down' ? 'error' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbStatus,
        ...(dbError ? { error: dbError } : {}),
      },
    };

    // Why 503: load balancers, Docker healthchecks and deploy scripts rely on the HTTP status
    // code, not on the body. Returning 200 for an unhealthy API would mark broken releases healthy.
    if (response.status === 'error') {
      throw new ServiceUnavailableException(response);
    }
    return response;
  }
}
