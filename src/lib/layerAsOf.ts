import { ACLED } from './acled';
import { CHOKEPOINTS_FILE } from './chokepoints';
import { DISPLACEMENT } from './displacement';
import { ELECTIONS_VERIFIED } from './elections';
import { MILITARY } from './military';
import { NUCLEAR } from './nuclear';
import { SANCTIONS } from './sanctions';
import { TRADE } from './trade';
import { UCDP } from './ucdp';
import { UNREST_VERIFIED } from './unrest';
import type { Layer } from './urlState';

/** When a layer's data was fetched or last verified (YYYY-MM-DD); layers have no history to replay. */
export function layerAsOf(layer: Layer): string | null {
  switch (layer) {
    case 'displacement':
      return DISPLACEMENT.fetchedAt;
    case 'sanctions':
      return SANCTIONS.fetchedAt;
    case 'elections':
      return ELECTIONS_VERIFIED;
    case 'nuclear':
      return NUCLEAR.verified;
    case 'acled':
    case 'acled-unrest':
      return ACLED.fetchedAt;
    case 'ucdp':
      return UCDP.fetchedAt;
    case 'military':
      return MILITARY.verified;
    case 'trade':
      return TRADE.fetchedAt;
    case 'chokepoints':
      return CHOKEPOINTS_FILE.verified;
    case 'unrest':
      return UNREST_VERIFIED;
    default:
      return null;
  }
}
