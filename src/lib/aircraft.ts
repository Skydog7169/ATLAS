import type { Aircraft, AircraftFeed } from '../../api/_lib/aircraft';

export type { Aircraft, AircraftFeed };

export const AIRCRAFT_MARKER_PREFIX = 'ac:';

export type AircraftRole = 'isr' | 'bomber' | 'tanker' | 'fighter' | 'transport' | 'helicopter' | 'vip' | 'trainer' | 'other';

export const ROLE_ORDER: AircraftRole[] = ['isr', 'bomber', 'tanker', 'fighter', 'transport', 'vip', 'helicopter', 'trainer', 'other'];

export const ROLE_LABEL: Record<AircraftRole, string> = {
  isr: 'Surveillance, AEW and patrol',
  bomber: 'Bombers',
  tanker: 'Tankers',
  fighter: 'Fighters and attack',
  transport: 'Transport and utility',
  vip: 'VIP and liaison jets',
  helicopter: 'Helicopters',
  trainer: 'Trainers',
  other: 'Other or unknown type',
};

/** One or two words for counts: "6 surveillance", "7 tankers". */
export const ROLE_SHORT: Record<AircraftRole, string> = { isr: 'surveillance', bomber: 'bombers', tanker: 'tankers', fighter: 'fighters', transport: 'transport', vip: 'VIP', helicopter: 'helicopters', trainer: 'trainers', other: 'other' };

export const ROLE_COLOR: Record<AircraftRole, string> = {
  isr: '#ffd166',
  bomber: '#ff7a1a',
  tanker: '#35e0ff',
  fighter: '#ff4f5e',
  transport: '#7aa2ff',
  vip: '#e052bd',
  helicopter: '#8cff7a',
  trainer: '#a7b4c6',
  other: '#d9e2ee',
};

/** Roles worth calling out: they reveal intelligence collection, strike posture and air-refuelling tracks. */
export const NOTABLE_ROLES: ReadonlySet<AircraftRole> = new Set(['isr', 'bomber', 'tanker']);

/** ICAO type designators by role. Unlisted rotorcraft fall back to the ADS-B emitter category A7. */
const ROLE_BY_TYPE: Record<string, AircraftRole> = {};
const add = (role: AircraftRole, types: string) => {
  for (const t of types.split(/\s+/)) ROLE_BY_TYPE[t] = role;
};
add('isr', 'R135 E3TF E3CF E6 E8 P8 P1 P3 U2 Q4 Q9 E2 E737 EP3 GLHK');
add('bomber', 'B52 B1 B2 T160 TU95 T95 TU22 T22M');
add('tanker', 'K35R K35E KC46 DC10 A332 A310');
add('fighter', 'F15 F16 F18H F18S F22 F35 F5 A10 EUFI RFAL TOR MIR2 SU27 SU30 SU35 MG29 J10 JF17 F4 GRIF');
add('transport', 'C17 C5 C5M C30J C130 C160 A400 C27J C295 CN35 KC2 IL76 A124 AN12 AN26 V22 B762 B190 D328 B350 BE20 BE9L C208 A748 E390');
add('helicopter', 'H60 H47 H64 H53 H53S AS65 UH1 B212 B412 B06 EC45 EC35 A109 A119 A139 S92 NH90 MI8 MI24 AS32 AS55 EH10 LYNX');
add('vip', 'B742 B752 B737 B736 B738 B739 GLF4 GLF5 GLF6 GL5T GL7T GLEX CL60 F900 FA7X FA8X LJ35 C560 C56X C680 C68A B77W A319 A320');
add('trainer', 'PC21 TEX2 T38 HAWK PC9 PC7 M346 T45 DA40 DA42 L39 K8');

/** Common designators spelled out when the feed gives no description. */
const TYPE_NAME: Record<string, string> = {
  K35R: 'KC-135R Stratotanker', K35E: 'KC-135E Stratotanker', KC46: 'KC-46 Pegasus', A332: 'A330 MRTT tanker-transport', R135: 'RC-135 reconnaissance', E3TF: 'E-3 Sentry AWACS', E3CF: 'E-3 Sentry AWACS',
  E6: 'E-6B Mercury', P8: 'P-8 Poseidon maritime patrol', P1: 'Kawasaki P-1 maritime patrol', P3: 'P-3 Orion', U2: 'U-2 Dragon Lady', Q4: 'RQ-4 Global Hawk / MQ-4C Triton', Q9: 'MQ-9 Reaper', E2: 'E-2 Hawkeye',
  B52: 'B-52 Stratofortress', B1: 'B-1B Lancer', B2: 'B-2 Spirit', C17: 'C-17 Globemaster III', C5M: 'C-5M Super Galaxy', C30J: 'C-130J Super Hercules', C130: 'C-130 Hercules', A400: 'A400M Atlas',
  C27J: 'C-27J Spartan', C295: 'C-295', KC2: 'Kawasaki C-2', V22: 'V-22 Osprey', H60: 'H-60 Black Hawk / Seahawk', H47: 'CH-47 Chinook', H64: 'AH-64 Apache', H53: 'CH-53', F35: 'F-35 Lightning II',
  F16: 'F-16 Fighting Falcon', F15: 'F-15 Eagle', F18S: 'F/A-18E/F Super Hornet', F18H: 'F/A-18 Hornet', F22: 'F-22 Raptor', EUFI: 'Eurofighter Typhoon', RFAL: 'Dassault Rafale', A10: 'A-10 Thunderbolt II',
  PC21: 'Pilatus PC-21 trainer', TEX2: 'T-6 Texan II trainer', T38: 'T-38 Talon trainer', HAWK: 'BAE Hawk trainer', B742: 'Boeing 747-200 (VC-25 when US)', B752: 'Boeing 757 (C-32 when US)',
  GLF5: 'Gulfstream V (C-37A when US)', GLF4: 'Gulfstream IV (C-20 when US)', B350: 'King Air 350', AS65: 'AS365 Dauphin / MH-65', UH1: 'UH-1 Iroquois / Huey',
};

export function roleOf(a: Aircraft): AircraftRole {
  const byType = a.t ? ROLE_BY_TYPE[a.t] : undefined;
  if (byType) return byType;
  if (a.cat === 'A7') return 'helicopter';
  if (a.desc && /tanker|stratotanker|mrtt/i.test(a.desc)) return 'tanker';
  if (a.desc && /helicopter|copter|black hawk|seahawk|chinook/i.test(a.desc)) return 'helicopter';
  return 'other';
}

export function typeName(a: Aircraft): string {
  return a.desc ?? (a.t ? (TYPE_NAME[a.t] ?? a.t) : 'Unknown type');
}

/** Transponder codes with a fixed meaning everywhere. */
export const SQUAWK_MEANING: Record<string, string> = { '7500': 'Unlawful interference (hijack)', '7600': 'Radio failure', '7700': 'General emergency' };

/** A declared emergency, from the emergency field or the squawk. */
export function emergencyOf(a: Aircraft): string | null {
  if (a.squawk && SQUAWK_MEANING[a.squawk]) return `${SQUAWK_MEANING[a.squawk]} (squawk ${a.squawk})`;
  if (a.emergency) return `Emergency declared: ${a.emergency}`;
  return null;
}

export function isNotable(a: Aircraft): boolean {
  return NOTABLE_ROLES.has(roleOf(a)) || emergencyOf(a) !== null;
}

export function callsign(a: Aircraft): string {
  return a.flight ?? a.r ?? a.hex.toUpperCase();
}

export function formatAltitude(a: Aircraft): string {
  if (a.ground) return 'on the ground';
  if (a.alt === null) return 'altitude unknown';
  if (a.alt >= 18000) return `FL${Math.round(a.alt / 100)}`;
  return `${a.alt.toLocaleString('en-US')} ft`;
}

export function aircraftLabel(a: Aircraft): string {
  const em = emergencyOf(a);
  return `${callsign(a)} · ${typeName(a)} · ${formatAltitude(a)}${a.gs !== undefined && !a.ground ? ` · ${a.gs} kt` : ''}${em ? ` · ${em}` : ''}`;
}

const NM_PER_DEG = 60;
/** Longest the map will dead-reckon past the last report: beyond this the position is a guess. */
export const MAX_EXTRAPOLATE_S = 300;

/** Point `seconds` ahead along the track at ground speed (rhumb-line step, fine over minutes). */
export function ahead([lon, lat]: [number, number], track: number, gsKnots: number, seconds: number): [number, number] {
  const nm = (gsKnots * seconds) / 3600;
  const rad = (track * Math.PI) / 180;
  const dLat = (nm * Math.cos(rad)) / NM_PER_DEG;
  const latNext = Math.max(-89.9, Math.min(89.9, lat + dLat));
  const cos = Math.max(0.01, Math.cos((((lat + latNext) / 2) * Math.PI) / 180));
  const dLon = (nm * Math.sin(rad)) / (NM_PER_DEG * cos);
  return [((((lon + dLon + 180) % 360) + 360) % 360) - 180, latNext];
}

/** Where the aircraft is now by dead reckoning from its last report, capped at MAX_EXTRAPOLATE_S. */
export function positionAt(a: Aircraft, feedNow: number, now: number): [number, number] {
  const base: [number, number] = [a.lon, a.lat];
  if (a.ground || a.gs === undefined || a.track === undefined || a.gs < 30) return base;
  const seconds = Math.min(MAX_EXTRAPOLATE_S, Math.max(0, (now - feedNow) / 1000 + a.age));
  return seconds > 0 ? ahead(base, a.track, a.gs, seconds) : base;
}

export interface RoleCount {
  role: AircraftRole;
  count: number;
}

export function countByRole(list: Aircraft[]): RoleCount[] {
  const counts = new Map<AircraftRole, number>();
  for (const a of list) counts.set(roleOf(a), (counts.get(roleOf(a)) ?? 0) + 1);
  return ROLE_ORDER.map((role) => ({ role, count: counts.get(role) ?? 0 }));
}

export interface AircraftFilter {
  /** Roles switched off in the legend. */
  hidden: ReadonlySet<AircraftRole>;
  /** Leave out aircraft on the ground. */
  airborneOnly: boolean;
  /** Only surveillance, bombers, tankers and emergencies. */
  notableOnly: boolean;
}

export const DEFAULT_AIRCRAFT_FILTER: AircraftFilter = { hidden: new Set(), airborneOnly: true, notableOnly: false };

export function applyFilter(list: Aircraft[], f: AircraftFilter): Aircraft[] {
  return list.filter((a) => !(f.airborneOnly && a.ground) && !f.hidden.has(roleOf(a)) && (!f.notableOnly || isNotable(a)));
}

/** "40 s ago", "3 min ago". */
export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 90 ? `${s} s ago` : `${Math.round(s / 60)} min ago`;
}

export function trackerUrl(hex: string): string {
  return `https://globe.adsb.lol/?icao=${encodeURIComponent(hex)}`;
}
