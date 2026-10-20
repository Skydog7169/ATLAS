import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type Theme = 'light' | 'dark';

/** Colour tokens from global.css's :root block, resolved per theme from their light-dark() pairs. */
export function themeTokens(): Record<Theme, Record<string, string>> {
  const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');
  const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  const out: Record<Theme, Record<string, string>> = { light: {}, dark: {} };
  for (const m of root.matchAll(/(--[\w-]+):\s*light-dark\(\s*(#[0-9a-fA-F]{3,6})\s*,\s*(#[0-9a-fA-F]{3,6})\s*\)\s*;/g)) {
    out.light[m[1]!] = m[2]!;
    out.dark[m[1]!] = m[3]!;
  }
  return out;
}

export function globalCss(): string {
  return readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');
}
