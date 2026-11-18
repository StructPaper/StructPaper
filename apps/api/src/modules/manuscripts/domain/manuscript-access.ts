import type { ManuscriptAccess } from '@structpaper/contracts';
import { subject, type AppAbility } from '../../access/domain/ability.factory';

/**
 * What the current user may do with ONE manuscript. Computed by the same CASL rules the
 * endpoints enforce, then sent to the client so the UI never has to guess (or compare roles).
 */
export function accessOf(ability: AppAbility | undefined, manuscript: any): ManuscriptAccess {
  if (!ability) return { canEdit: false, canShare: false, canDelete: false };
  const target = subject('Manuscript', manuscript);
  return {
    canEdit: ability.can('update', target),
    canShare: ability.can('share', target) || ability.can('manage', target),
    canDelete: ability.can('delete', target) || ability.can('manage', target),
  };
}
