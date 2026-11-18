import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PlatformModule } from './modules/platform/platform.module';
import { IdentityModule } from './modules/identity/identity.module';
import { UsersModule } from './modules/users/users.module';
import { AccessModule } from './modules/access/access.module';
import { AssetsModule } from './modules/assets/assets.module';
import { ManuscriptsModule } from './modules/manuscripts/manuscripts.module';
import { SyncModule } from './modules/sync/sync.module';
import { JournalsModule } from './modules/journals/journals.module';
import { JwtAuthGuard } from './modules/access/presentation/guards/jwt-auth.guard';

@Module({
  imports: [
    PlatformModule,
    IdentityModule,
    UsersModule,
    AccessModule,
    AssetsModule,
    ManuscriptsModule,
    SyncModule,
    JournalsModule,
  ],
  providers: [
    // Secure by default: every route needs a valid token unless it is marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
