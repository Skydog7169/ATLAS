export function isoForName(name: string | null | undefined): string | null;
export function aggregate(
  rows: Array<{ country?: string; type_of_violence?: number | string; best?: number | string | null }>,
  into?: Map<string, { iso: string; stateBased: number; nonState: number; oneSided: number; events: number }>,
  unmapped?: Set<string>,
): Map<string, { iso: string; stateBased: number; nonState: number; oneSided: number; events: number }>;
