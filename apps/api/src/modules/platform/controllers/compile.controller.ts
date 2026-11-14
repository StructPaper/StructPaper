import { Controller, Post, Body, Res, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { CompileService, type CompileLatexRequest } from '../application/compile.service';

@Controller('compile')
export class CompileController {
  constructor(@Inject(CompileService) private readonly compileService: CompileService) {}

  @Post('latex')
  @HttpCode(HttpStatus.OK)
  async compileLatex(
    @Body() body: CompileLatexRequest,
    @Res() reply: any,
  ) {
    const result = await this.compileService.compile(body || {});

    // Fastify Reply support
    if (reply && typeof reply.header === 'function') {
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', 'inline; filename="article.pdf"')
        .header('X-Compiler-Engine', result.engine || 'NestJS Compiler Engine');
      return reply.send(result.pdfBuffer);
    }

    // Express Response support
    if (reply && typeof reply.setHeader === 'function') {
      reply.setHeader('Content-Type', 'application/pdf');
      reply.setHeader('Content-Disposition', 'inline; filename="article.pdf"');
      reply.setHeader('X-Compiler-Engine', result.engine || 'NestJS Compiler Engine');
      if (typeof reply.send === 'function') {
        return reply.send(result.pdfBuffer);
      }
      return reply.end(result.pdfBuffer);
    }

    return result.pdfBuffer;
  }
}
