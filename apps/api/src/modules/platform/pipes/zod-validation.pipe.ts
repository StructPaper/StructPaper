import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, _metadata?: ArgumentMetadata): unknown {
    if (!this.schema) {
      return value;
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }
}
