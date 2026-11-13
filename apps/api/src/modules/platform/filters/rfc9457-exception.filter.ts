import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { createProblemDetails, InvalidParam, ProblemDetails } from '@structpaper/contracts';

@Catch()
export class Rfc9457ExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(Rfc9457ExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const instance = request?.raw?.url || request?.url || '';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred';
    let type = 'about:blank';
    let code: string | undefined;
    let invalidParams: InvalidParam[] | undefined;
    let extensions: Record<string, unknown> = {};

    if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      title = 'Bad Request';
      detail = 'Request validation failed';
      code = 'VALIDATION_ERROR';
      invalidParams = exception.errors.map((err) => ({
        name: err.path.join('.') || 'body',
        reason: err.message,
      }));
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        detail = res;
        title = this.getDefaultTitleForStatus(status);
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        title = resObj.title || (typeof resObj.error === 'string' ? resObj.error : this.getDefaultTitleForStatus(status));
        if (typeof resObj.type === 'string') {
          type = resObj.type;
        }

        if (resObj.detail && typeof resObj.detail === 'string') {
          detail = resObj.detail;
        } else if (typeof resObj.message === 'string') {
          detail = resObj.message;
        } else if (Array.isArray(resObj.message)) {
          detail = resObj.message.join('; ');
        } else {
          detail = exception.message || this.getDefaultTitleForStatus(status);
        }

        if (resObj.code && typeof resObj.code === 'string') {
          code = resObj.code;
        }

        if (Array.isArray(resObj.invalidParams)) {
          invalidParams = resObj.invalidParams;
        }

        const excludedKeys = new Set([
          'statusCode',
          'message',
          'error',
          'title',
          'detail',
          'code',
          'invalidParams',
          'type',
          'instance',
        ]);

        for (const [key, value] of Object.entries(resObj)) {
          if (!excludedKeys.has(key)) {
            extensions[key] = value;
          }
        }
      } else {
        detail = exception.message;
        title = this.getDefaultTitleForStatus(status);
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      title = 'Internal Server Error';
      detail = process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : exception.message;
    } else {
      this.logger.error('Unhandled unknown exception', exception);
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      title = 'Internal Server Error';
      detail = 'An unexpected error occurred';
    }

    const problemDetails: ProblemDetails = createProblemDetails({
      type,
      title,
      status,
      detail,
      instance,
      code,
      invalidParams,
      extensions,
    });

    response
      .status(status)
      .header('content-type', 'application/problem+json')
      .send(problemDetails);
  }

  private getDefaultTitleForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.PRECONDITION_FAILED:
        return 'Precondition Failed';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'Unprocessable Entity';
      case HttpStatus.INTERNAL_SERVER_ERROR:
      default:
        return status >= 500 ? 'Internal Server Error' : 'Error';
    }
  }
}
