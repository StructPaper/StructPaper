import { Module } from '@nestjs/common';
import { PlatformModule } from './modules/platform/platform.module';
import { IdentityModule } from './modules/identity/identity.module';
import { UsersModule } from './modules/users/users.module';
import { AccessModule } from './modules/access/access.module';
import { AssetsModule } from './modules/assets/assets.module';
import { ManuscriptsModule } from './modules/manuscripts/manuscripts.module';
import { SyncModule } from './modules/sync/sync.module';
import { JournalsModule } from './modules/journals/journals.module';

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
})
export class AppModule {}
