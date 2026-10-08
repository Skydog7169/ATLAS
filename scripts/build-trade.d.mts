export const EU27: string[];
export function parseSdmx(json: unknown): Map<string, Map<string, number>>;
export function buildRows(year: number, usChn: Map<string, Map<string, number>>, eu: Map<string, Map<string, number>>, world: Map<string, Map<string, number>>): Array<{ iso: string; year: number; exportsUsd: number; us: number; china: number; eu: number }>;
