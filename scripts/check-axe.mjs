// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE GATE THE SHARED CI ASKS FOR BY NAME =========================
// `the-inclusionist-engine/.github/workflows/game-ci.yml` offers one optional step, and writes the
// reason it is optional rather than default: axe «needs the game to be servable at a URL, and a
// game whose shell is still a scaffold has nothing to serve». It then says the thing that decided
// this file: «⚠️ A game that ships to a school with `a11y: false` is a game that skipped pillar 2,
// and the input is named so that skipping it is a VISIBLE line in the caller instead of an absence.»
//
// The Dev chose `a11y: true` on 2026-10-04, in those words: «Portão axe a sério… Faça isso por
// favor.» So this is the real thing — axe-core driven over the BUILT page — and not a script named
// `test:a11y` that runs something else.
//
// ========================= ⚠️ TWO STATES, BECAUSE THE GAME HAS TWO =========================
// Auditing the page as it loads would audit the SPLASH and call it the game. Everything this
// repository is about — the board, the panel, the move list, the clocks, the opening note — exists
// only after JOGAR. So the audit runs twice: once on the first screen a child meets, once on the
// screen they then spend an hour in. A violation in either is a violation.
//
// ========================= WHERE THE URL COMES FROM =========================
// The shared workflow starts `npm run preview` and passes `AXE_URL`. Locally there is no preview
// running, so this falls back to the same static server `check-rendered.mjs` uses. One gate, two
// ways in, and `npm run test:a11y` means the same thing on a laptop as on a runner.

import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { serveDist } from './serve-dist.mjs';

/*
 * ⚠️ THE TAG LIST IS THE CONFORMANCE CLAIM, and it is written out rather than left to axe's
 * default so that raising it is an edit somebody makes on purpose. A, AA and the 2.1/2.2 additions:
 * 2.5.8 (target size, 24 px) lives in 2.2 AA and is one of the two rules this game is built around.
 *
 * 📌 AAA IS NOT IN THE LIST, and the omission is not modesty. `docs/` records this game reaching for
 * 2.5.5 (44 px targets, AAA) and `check-rendered.mjs` already measures it, to the pixel, in all
 * three views — by a rule written here rather than by axe's generic one. Turning on `wcag2aaa`
 * would also turn on rules nobody in this project has decided about, such as 1.4.6's 7:1 contrast,
 * and a gate that goes red over an undecided rule is a gate that gets switched off.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

const url = process.env.AXE_URL ?? null;
const served = url ? null : await serveDist();
const target = url ?? `${served.origin}/`;

const browser = await chromium.launch();
/*
 * ⚠️ A REAL VIEWPORT AND NOT THE DEFAULT 1280×720, because half of what this game does is size
 * itself. 1366×768 is the commonest laptop in a Brazilian public school; the stage is 16:9 and
 * `ui/layout` computes every target size from the width it is given, so auditing at a width nobody
 * has would audit targets nobody sees.
 *
 * ⚠️ AND AN EXPLICIT CONTEXT, NOT `browser.newPage()`. Axe refuses a page from the implicit
 * context outright — «Please use browser.newContext()» — because it injects itself into every
 * frame and needs a context it can reach. The shortcut fails at the first `analyze()`, not at
 * launch, so it looks like an axe problem and is not.
 */
const context = await browser.newContext({
  viewport: { width: 1366, height: 768 },
  /*
   * 🔴 PINNED, like `check-rendered.mjs`, and measured the same day for the same reason: the
   * built page reads `navigator.language`, a GitHub runner claims `en-US`, and this gate used
   * to look for a button named «JOGAR». `pt-BR` is the language this game is delivered in.
   *
   * 📌 AND THE AUDIT WAS RUN AT `en-US` BEFORE THE PIN WENT IN: zero violations there too, on both
   * screens. English labels are longer and a target that stopped fitting is exactly what axe would
   * have caught, so the pin is determinism rather than cover.
   *
   * ⚠️ Spanish has not been audited, and it is not covered by English having passed.
   */
  locale: 'pt-BR',
});
const page = await context.newPage();

const problems = [];

/** Runs axe over the page as it stands and files anything it finds under `state`. */
async function audit(state) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const v of violations) {
    const where = v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join(' | ');
    const more = v.nodes.length > 4 ? ` (+${v.nodes.length - 4} more)` : '';
    problems.push(`${state}: [${v.impact ?? 'unknown'}] ${v.id} — ${v.help}\n    ${where}${more}\n    ${v.helpUrl}`);
  }
  return violations.length;
}

try {
  await page.goto(target, { waitUntil: 'load' });
  /*
   * ⚠️ WAITED FOR BY CONDITION, NEVER BY A TIMEOUT. The splash is drawn by the engine after the
   * module graph settles; auditing a page that has not drawn yet is how an a11y gate comes back
   * green on an empty body. The same rule `check-rendered.mjs` follows.
   */
  await page.waitForSelector('#splash', { state: 'visible', timeout: 30_000 });
  const onSplash = await audit('splash');

  // ⚠️ BY ID. The word on this button is a translation; `#splash-play` is the button. See the
  // same change in `check-rendered.mjs`, which this one learned from twice.
  await page.locator('#splash-play').click();
  await page.waitForSelector('#game-region .chess-hud', { state: 'visible', timeout: 30_000 });
  // The board's own cells, so the audit sees the grid mirror as the game builds it.
  await page.waitForSelector('[role="gridcell"]', { state: 'attached', timeout: 30_000 });
  const inGame = await audit('game');

  if (problems.length > 0) {
    console.error(`\naxe: ${problems.length} violation type(s) across the two screens.\n`);
    for (const p of problems) console.error(`  · ${p}\n`);
    console.error('Each line is a WCAG rule, not a style opinion. Fix it or record why the rule');
    console.error('does not apply — this gate has no allow-list on purpose.\n');
    process.exitCode = 1;
  } else {
    console.log(
      `axe ok — no ${TAGS.join('/')} violations on the splash (${onSplash}) `
      + `or in the running game (${inGame}), at 1366×768, against ${target}`,
    );
  }
} finally {
  await browser.close();
  served?.server.close();
}
