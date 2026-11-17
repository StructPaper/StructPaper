import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UsePipes,
  Inject,
} from '@nestjs/common';
import {
  UploadIntentSchema,
  UploadCompleteSchema,
  type UploadIntent,
  type UploadComplete,
} from '@structpaper/contracts';
import { ZodValidationPipe } from '../../platform/pipes/zod-validation.pipe';
import { AssetService } from '../application/asset.service';

@Controller('assets')
export class AssetController {
  constructor(@Inject(AssetService) private readonly assetService: AssetService) {}

  @Post('upload-intent')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(UploadIntentSchema))
  async createUploadIntent(@Body() body: UploadIntent, @Req() req: any) {
    const userId = req.user?.id;
    return this.assetService.createUploadIntent(body, userId);
  }

  @Post('upload-complete')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(UploadCompleteSchema))
  async completeUpload(@Body() body: UploadComplete, @Req() req: any) {
    const userId = req.user?.id;
    return this.assetService.completeUpload(body, userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getById(@Param('id') id: string) {
    return this.assetService.getAssetById(id);
  }
}
