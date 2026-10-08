export const FROM: number;
export function tabulate(rows: Array<{ countryiso3code: string; date: string; value: number | null }>, from?: number, to?: number): { from: number; to: number; gdpUsd: Record<string, Array<number | null>> };
