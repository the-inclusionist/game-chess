// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE DOCUMENT AND THE CODE CANNOT DISAGREE =========================
// The measured contrast table used to be drawn over the board while a palette was being chosen.
// It is `docs/CONTRAST.md` now, and a document is exactly the kind of place numbers go stale: this
// repository has already shipped a high-contrast palette whose squares measured 2.13:1 while every
// comment around it said otherwise.
//
// So the document is GENERATED and this test is what holds it there. To update it after changing
// an ink: `WRITE_DOCS=1 npx vitest run tests/contrast-doc.node.test.ts`.
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOARD_THEMES } from '../app/js/ui/board-themes.ts';
import { contrastMarkdown, contrastRows, FLOOR } from '../app/js/ui/contrast-report.ts';
import { createI18n } from '../app/js/i18n/index.ts';

const DOC = new URL('../docs/CONTRAST.md', import.meta.url);
const START = '<!-- GERADO: nao edite a mao -->';
const END = '<!-- FIM DO GERADO -->';

const table = (): string => {
  const i18n = createI18n('pt');
  return contrastMarkdown(BOARD_THEMES, (key) => i18n.t(key));
};

describe('[Docs] the contrast table', () => {
  it('says exactly what the palettes measure', () => {
    const block = `${START}\n\n${table()}\n\n${END}`;
    const doc = readFileSync(DOC, 'utf8');

    if (process.env.WRITE_DOCS) {
      const before = doc.slice(0, doc.indexOf(START));
      const after = doc.slice(doc.indexOf(END) + END.length);
      writeFileSync(DOC, `${before}${block}${after}`, 'utf8');
    }

    // ⚠️ The whole generated block, not a row of it. A test that checked one number would pass
    // while the rest of the table drifted, which is the failure mode a generated document has.
    expect(readFileSync(DOC, 'utf8')).toContain(block);
  });

  it('names every palette the game offers, and no others', () => {
    const doc = readFileSync(DOC, 'utf8');
    const i18n = createI18n('pt');
    for (const theme of BOARD_THEMES) expect(doc).toContain(i18n.t(theme.short));
    // José-2 was removed from the game; a document still listing it would be describing a
    // palette nobody can choose.
    expect(doc).not.toContain('José-2');
  });

  it('states the floor it is measuring against', () => {
    expect(readFileSync(DOC, 'utf8')).toContain(`${FLOOR}:1`);
  });

  it('marks the pairs that touch, because those are the ones that must pass', () => {
    // The distinction the whole table turns on: two colours that never share an edge have no
    // boundary between them and no 1.4.11 to satisfy.
    const doc = readFileSync(DOC, 'utf8');
    const touching = contrastRows(BOARD_THEMES[0]).filter((row) => !row.optional);
    expect(touching.length).toBeGreaterThan(0);
    expect(doc).toContain('**(encosta)**');
  });
});
