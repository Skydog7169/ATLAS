import type { LayerOption } from '../components/LayerMenu';
import { ACLED } from './acled';
import { UCDP, ucdpYear } from './ucdp';
import type { Layer } from './urlState';

export const LAYER_OPTIONS: LayerOption[] = [
  { id: 'displacement', label: 'Displacement', hint: 'People displaced from each country (UNHCR)' },
  { id: 'sanctions', label: 'Sanctions', hint: 'UN, US and EU regimes targeting the country' },
  { id: 'elections', label: 'Elections', hint: 'Months to the next national election' },
  { id: 'nuclear', label: 'Nuclear', hint: 'Armed, threshold, hosting and umbrella states' },
  { id: 'military', label: 'Military presence', hint: 'Foreign bases, deployments and peace operations by host' },
  { id: 'trade', label: 'Trade dependence', hint: 'Export share to the US, China or the EU (WITS)' },
  { id: 'chokepoints', label: 'Chokepoints', hint: 'Eight maritime passages with dated status' },
  { id: 'unrest', label: 'Civil unrest', hint: 'Protest movements, riots, uprisings, coups and crackdowns' },
  // The ACLED slot only appears when the weekly build had credentials for the API.
  ...(ACLED.available ? [{ id: 'acled' as const, label: 'Violence events', hint: `ACLED political-violence events, last ${ACLED.days} days` }] : []),
  ...(ACLED.available ? [{ id: 'acled-unrest' as const, label: 'Protests and riots', hint: `ACLED protest and riot events, last ${ACLED.days} days` }] : []),
  ...(UCDP.available ? [{ id: 'ucdp' as const, label: 'Organised violence', hint: `UCDP deaths in state-based, non-state and one-sided violence, ${ucdpYear()}` }] : []),
];

const AVAILABLE = new Set<string>(LAYER_OPTIONS.map((o) => o.id));

/** Whether this build can draw the layer; credential-gated sources are absent when their fetch failed. */
export function isLayerAvailable(id: string): boolean {
  return AVAILABLE.has(id);
}

export const LAYER_LABEL: ReadonlyMap<Exclude<Layer, null>, string> = new Map(LAYER_OPTIONS.map((o) => [o.id, o.label]));
