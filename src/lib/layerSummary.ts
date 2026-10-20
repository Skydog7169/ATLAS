import { displacementSummary } from './displacement';
import { sanctionsSummary } from './sanctions';
import { electionSummary } from './elections';
import { nuclearSummary } from './nuclear';
import { acledSummary, acledUnrestSummary } from './acled';
import { ucdpSummary, ucdpYear } from './ucdp';
import { militarySummary } from './military';
import { tradeSummary } from './trade';
import { unrestSummary } from './unrest';
import type { Layer } from './urlState';

/**
 * One line with a country's value on the active data layer, as the hover
 * tooltip shows it. Touch screens have no hover, so the dossier repeats it.
 * Null when no layer is on (or the layer has no per-country reading).
 */
export function layerSummary(layer: Layer, iso: string): string | null {
  switch (layer) {
    case 'displacement':
      return displacementSummary(iso);
    case 'sanctions': {
      const s = sanctionsSummary(iso);
      return s ? `Sanctions: ${s}` : 'No country-level sanctions regime';
    }
    case 'elections':
      return electionSummary(iso) ?? 'No election on record';
    case 'nuclear':
      return nuclearSummary(iso) ?? 'No nuclear role recorded';
    case 'acled':
      return acledSummary(iso) ?? 'No ACLED events in the window';
    case 'acled-unrest':
      return acledUnrestSummary(iso) ?? 'No ACLED protests or riots in the window';
    case 'ucdp':
      return ucdpSummary(iso) ?? (ucdpYear() ? `No organised-violence deaths recorded in ${ucdpYear()}` : 'No data: UCDP unavailable in this build');
    case 'military':
      return militarySummary(iso) ?? 'No foreign military presence recorded';
    case 'trade':
      return tradeSummary(iso) ?? 'No WITS export data';
    case 'unrest':
      return unrestSummary(iso) ?? 'No tracked unrest';
    default:
      return null;
  }
}
