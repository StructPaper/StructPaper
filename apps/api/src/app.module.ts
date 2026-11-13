import { Module } from '@nestjs/common';
import { PlatformModule } from './modules/platform/platform.module';
import { IdentityModule } from './modules/identity/identity.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [PlatformModule, IdentityModule, UsersModule],
})
export class AppModule {}
