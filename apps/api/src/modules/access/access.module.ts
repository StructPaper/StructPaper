import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AbilityFactory } from './domain/ability.factory';
import { AbilityCacheService } from './domain/ability-cache.service';
import { InMemoryAbilityCacheService } from './infrastructure/ability-cache.service';
import { AccessService } from './application/access.service';
import { AccessController } from './presentation/access.controller';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { PoliciesGuard } from './presentation/guards/policies.guard';

@Module({
  imports: [IdentityModule],
  controllers: [AccessController],
  providers: [
    AbilityFactory,
    InMemoryAbilityCacheService,
    {
      provide: AbilityCacheService,
      useExisting: InMemoryAbilityCacheService,
    },
    AccessService,
    JwtAuthGuard,
    PoliciesGuard,
  ],
  exports: [
    AbilityFactory,
    AbilityCacheService,
    InMemoryAbilityCacheService,
    AccessService,
    JwtAuthGuard,
    PoliciesGuard,
  ],
})
export class AccessModule {}
