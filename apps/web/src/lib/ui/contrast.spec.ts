import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

/**
 * Reads the real tokens from globals.css (the `:root` block) and checks every pair the design
 * system uses against WCAG AA: 4.5:1 for text, 3:1 for UI components and focus indicators.
 */
const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
const tokens = new Map(
  [...rootBlock.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1]!, m[2]!]),
);

function token(name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`Token --${name} not found in globals.css :root`);
  return value;
}

const TEXT = 4.5;
const UI = 3;

/** [foreground, background, minimum ratio, where it is used] */
const pairs: [string, string, number, string][] = [
  ['foreground', 'background', TEXT, 'body text'],
  ['card-foreground', 'card', TEXT, 'card text'],
  ['foreground', 'card', TEXT, 'text on cards'],
  ['muted-foreground', 'background', TEXT, 'secondary text on page'],
  ['muted-foreground', 'card', TEXT, 'secondary text on cards'],
  ['muted-foreground', 'muted', TEXT, 'secondary text on muted fill'],
  ['foreground', 'muted', TEXT, 'text on muted fill'],
  ['primary-foreground', 'primary', TEXT, 'primary button label'],
  ['primary-foreground', 'primary-hover', TEXT, 'primary button label on hover'],
  ['accent-foreground', 'accent', TEXT, 'accent text and ghost button hover'],
  ['link', 'background', TEXT, 'links and active tab on page'],
  ['link', 'card', TEXT, 'links on cards'],
  ['link', 'accent', TEXT, 'links on accent fill'],
  ['destructive-foreground', 'destructive', TEXT, 'danger button label'],
  ['destructive-foreground', 'destructive-hover', TEXT, 'danger button label on hover'],
  ['destructive-soft-foreground', 'destructive-soft', TEXT, 'error message and state'],
  ['destructive-soft-foreground', 'card', TEXT, 'field error on cards'],
  ['destructive-soft-foreground', 'background', TEXT, 'field error on page'],
  ['warning-soft-foreground', 'warning-soft', TEXT, 'warning badge and notice'],
  ['success-soft-foreground', 'success-soft', TEXT, 'success badge'],
  ['positive', 'card', TEXT, 'recebe amount on cards'],
  ['positive', 'background', TEXT, 'recebe amount on page'],
  ['negative', 'card', TEXT, 'deve amount on cards'],
  ['negative', 'background', TEXT, 'deve amount on page'],
  ['input', 'card', UI, 'field border on cards'],
  ['input', 'background', UI, 'field border on page'],
  ['ring', 'background', UI, 'focus ring on page'],
  ['ring', 'card', UI, 'focus ring on cards'],
  ['ring', 'muted', UI, 'focus ring on muted fill'],
  ['primary', 'background', UI, 'primary button against the page'],
  ['primary', 'card', UI, 'primary button against cards'],
  ...Array.from({ length: 8 }, (_, i): [string, string, number, string] => [
    `avatar-${i + 1}-foreground`,
    `avatar-${i + 1}`,
    TEXT,
    `avatar ${i + 1} initials`,
  ]),
];

describe('design tokens contrast (WCAG AA)', () => {
  it('finds the tokens in globals.css', () => {
    expect(tokens.size).toBeGreaterThan(30);
  });

  it.each(pairs)('%s on %s is at least %d:1 (%s)', (fg, bg, minimum) => {
    const ratio = contrastRatio(token(fg), token(bg));
    expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimum);
  });
});

/**
 * The legacy aliases (brand-*, surface, ink, line, danger-*, page, radius-card) were removed when
 * the last screens moved to the design tokens (issue #55). Keep them out so screens cannot drift
 * back to a second palette.
 */
describe('legacy token aliases', () => {
  const legacyClass =
    /\b(?:bg|text|border|ring|divide|outline|fill|stroke|from|to|via|border-l)-(?:brand-\d+|surface|ink|line|page|danger-\d+)\b|\brounded-card\b/;

  it('are no longer defined in globals.css', () => {
    expect(css).not.toMatch(/--color-(brand-\d+|surface|ink|line|page|danger-\d+)\s*:/);
    expect(css).not.toMatch(/--radius-card\s*:/);
  });

  it('are not used by any component or page', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry) && !/\.spec\./.test(entry)) {
          if (legacyClass.test(readFileSync(path, 'utf8'))) offenders.push(path);
        }
      }
    };
    walk(new URL('../../', import.meta.url).pathname);
    expect(offenders, 'use the design tokens (border-border, bg-card, text-link...)').toEqual([]);
  });
});
