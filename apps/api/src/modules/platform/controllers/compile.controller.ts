import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { CompileService, type CompileLatexRequest } from '../application/compile.service';
import { CompileQueue } from '../application/compile-queue';

@Controller('compile')
export class CompileController {
  constructor(
    @Inject(CompileService) private readonly compileService: CompileService,
    @Inject(CompileQueue) private readonly queue: CompileQueue,
  ) {}

  /** How busy the compilers are, and how many of MY papers are running or waiting (survives a page reload). */
  @Get('status')
  status(@Req() req: any) {
    return this.queue.status(req.user?.id ?? 'anonymous');
  }

  @Post('latex')
  @HttpCode(HttpStatus.OK)
  async compileLatex(
    @Body() body: CompileLatexRequest,
    @Req() req: any,
    @Res() reply: any,
  ) {
    const result = await this.compileService.compile(body || {}, req.user?.id ?? 'anonymous');

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
