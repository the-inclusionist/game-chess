// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= WHY THIS EXISTS =========================
// Everything else in this repository measures the ARITHMETIC. This measures the PAGE.
//
// The Dev chose it on 2026-10-04 (option B) after three defects in three days that every one of
// 918 green tests was blind to, and they are blind to it for the same reason each time: the code
// computed the right number and nobody looked at the result.
//
//   · the 3D board was drawn MIRRORED — files running h..a — for the whole life of the view;
//   · every mark in that view was laid UNDERNEATH the board, so it answered nothing;
//   · the panel's buttons changed height on the first click, because two owners wrote `--tap`.
//
// ⚠️ AND WHY VITEST'S BROWSER MODE WAS NOT ENOUGH, which is the part worth writing down: it runs
// a fixture, not the page. The engine's stylesheet arrives through an `@import` chain that the
// fixture does not finish applying before an assertion runs — there is an `it.skip` in
// `tests/shell.browser.test.ts` that says exactly this, about exactly this kind of measurement.
// So this drives the BUILT `dist/`, served over HTTP, in a real browser, with the real CSS.
//
// ========================= WHAT IT DOES NOT DO =========================
// It is not a screenshot comparison and it is deliberately small. Three questions, each one tied
// to a defect that actually shipped, asked in all three views. A broad visual suite would cost
// more to maintain than it catches; `npm run validate` has to stay something a person runs.
//
// No new dependency: `playwright` is already here for Vitest's browser mode, and its chromium is
// already downloaded.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../dist', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};

/** A static server over `dist/`, on whatever port the OS hands out. */
async function serve() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    // ⚠️ THE DIRECTORY CHECK COMES BEFORE `normalize`, and on Windows it has to: `normalize('/')`
    // answers `\`, so asking the normalised path whether it ends in a slash is always no and `/`
    // never resolves to index.html. The page came back blank and the first symptom was a 404.
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const path = normalize(pathname);
    // ⚠️ The join is guarded: a served tree is a served tree, even on a developer's laptop.
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { server, port: server.address().port };
}

const problems = [];
const fail = (what) => problems.push(what);

/**
 * ⚠️ MEASURED IN THE PAGE, NOT REPORTED FROM IT. Everything below runs inside the browser and
 * returns NUMBERS; the judging happens out here. A probe that decided for itself whether it was
 * happy would be a second place for the expectation to live.
 */
const measure = (page) => page.evaluate(() => {
  const region = document.querySelector('#game-region');
  const regionBox = region.getBoundingClientRect();
  const rung = Number.parseFloat(getComputedStyle(region).getPropertyValue('--chess-tap'));

  /*
   * ⚠️ `.sr-only` IS NOT "SMALL", IT IS "NOT FOR EYES". The grid mirror names all sixty-four
   * squares to a screen reader, and in the projected and solid views it is clipped to a pixel
   * rather than removed — because a reader has to be able to reach it. Measuring those cells as
   * if they were buttons on the page reported sixty-four controls six pixels tall, which is
   * exactly the kind of noise that makes a gate get switched off.
   *
   * In the FLAT view the same mirror is the visible board, so its cells are real targets and are
   * measured. The test is the class, not the size.
   */
  const seen = (el) => {
    if (el.closest('.sr-only')) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0';
  };

  /*
   * ⚠️ A CHECKBOX'S TARGET IS THE BOX AND ITS LABEL TOGETHER, because clicking either one toggles
   * it — WCAG 2.5.8 measures the clickable region, not the glyph. Measuring the `<input>` alone
   * reported a 9.6 px control for a row a finger hits anywhere along, which is a true number about
   * the wrong thing.
   */
  const targetOf = (el) => {
    if (el.tagName !== 'INPUT' || el.type !== 'checkbox') return el.getBoundingClientRect();
    const label = el.id ? region.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
    const row = el.closest('label') ?? (label ? label.parentElement : null);
    return (row ?? el).getBoundingClientRect();
  };

  /*
   * ⚠️ BEING BELOW THE FOLD OF A SCROLLER IS NOT BEING CLIPPED. The side panel scrolls on purpose
   * — the Dev asked for these settings to be "acessível por rolagem" — so a control past the
   * bottom of `#game-region` is reachable, not lost. The first version of this check called every
   * one of them clipped and would have had the panel redesigned to silence it.
   */
  const scroller = (el) => {
    for (let n = el.parentElement; n && n !== region.parentElement; n = n.parentElement) {
      const o = getComputedStyle(n).overflowY;
      if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
    }
    return null;
  };

  const controls = [...region.querySelectorAll('button, select, input, a[href]')]
    .filter((el) => seen(el) && !el.disabled)
    .map((el) => {
      const r = targetOf(el);
      return {
        name: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 28),
        // ⚠️ The engine's own nodes answer to the engine's floor, not to this cartridge's ladder.
        engine: el.closest('.a11y-bar, .screen-pause, .pause-icons, #vp-pause-0') !== null,
        scrolls: scroller(el) !== null,
        w: r.width, h: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      };
    });

  /*
   * ⚠️ THE BOARD AND THE LABELS ARE MEASURED FOR CLIPPING TOO, AND THE FIRST VERSION OF THIS GATE
   * DID NOT. It checked only `button, select, input` — so the one defect it was built from, "o
   * tabuleiro em 2,5D esta grande demais, ele nao cabe na tela", would have walked straight past
   * it. Found by mutation: growing the board past the region changed nothing in the report.
   */
  const boxOf = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width }; };
  const surfaces = [...document.querySelectorAll('#board-canvas, .stage-3d, .board-2d, .coords-label')]
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => ({
      name: el.classList.contains('coords-label') ? `coordinate "${el.textContent}"` : (el.id || el.className || el.tagName),
      scrolls: scroller(el) !== null,
      ...boxOf(el),
    }));

  const labels = [...document.querySelectorAll('.coords-label')].map((el) => {
    const r = el.getBoundingClientRect();
    return { text: el.textContent, kind: el.dataset.kind, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
  });

  return { rung, regionBox: { left: regionBox.left, right: regionBox.right, top: regionBox.top, bottom: regionBox.bottom }, controls, surfaces, labels };
});

function judge(view, m) {
  const where = `[${view}]`;

  // ========================= 1. A TARGET IS A FINGER =========================
  // The ladder is the Dev's decision of 2026-10-04: 24 / 34 / 44 by board side, never under the
  // WCAG 2.5.8 floor. This is the question that caught nothing while the buttons were halving
  // themselves on the first click, because the only thing measured was the VARIABLE.
  if (!(m.rung >= 24)) fail(`${where} --chess-tap is ${m.rung}, under the WCAG 2.5.8 floor of 24`);
  for (const c of m.controls) {
    if (c.engine) continue;
    if (c.h + 0.5 < m.rung) fail(`${where} "${c.name}" is ${c.h.toFixed(1)}px tall, under the ${m.rung}px rung`);
  }

  // ========================= 2. NOTHING IS CUT OFF =========================
  // `#game-region` clips. A control that reaches past it is not short, it is GONE — which is how
  // "o tabuleiro nao cabe na tela" and the labels off the edge were reported rather than caught.
  for (const c of [...m.controls, ...m.surfaces]) {
    // Inside a scroller: reachable by scrolling, which is what the panel is for.
    if (c.scrolls) continue;
    const out = [];
    if (c.left < m.regionBox.left - 0.5) out.push('left');
    if (c.right > m.regionBox.right + 0.5) out.push('right');
    if (c.top < m.regionBox.top - 0.5) out.push('top');
    if (c.bottom > m.regionBox.bottom + 0.5) out.push('bottom');
    if (out.length) fail(`${where} ${c.name.startsWith('coordinate') ? c.name : `"${c.name}"`} is clipped by #game-region on the ${out.join(' and ')}`);
  }

  // ========================= 3. THE BOARD READS a..h AND 8..1 =========================
  // The one that would have caught the mirrored 3D board on the morning it was written, instead of
  // months later and only because the letters arrived to make it visible.
  const files = m.labels.filter((l) => l.kind === 'file');
  const ranks = m.labels.filter((l) => l.kind === 'rank');
  if (files.length) {
    if (files.map((l) => l.text).join('') !== 'abcdefgh') fail(`${where} the file labels read ${files.map((l) => l.text).join('')}`);
    for (let i = 1; i < files.length; i++) {
      if (files[i].x <= files[i - 1].x) {
        fail(`${where} file ${files[i].text} is not right of ${files[i - 1].text} — the board is mirrored`);
        break;
      }
    }
    for (const l of [...files, ...ranks]) {
      if (l.w === 0) fail(`${where} the label "${l.text}" has no box: it is not drawn`);
    }
  }
  if (ranks.length) {
    if (ranks.map((l) => l.text).join('') !== '87654321') fail(`${where} the rank labels read ${ranks.map((l) => l.text).join('')}`);
    for (let i = 1; i < ranks.length; i++) {
      if (ranks[i].y <= ranks[i - 1].y) {
        fail(`${where} rank ${ranks[i].text} is not below ${ranks[i - 1].text} — the board is flipped`);
        break;
      }
    }
  }
}

/**
 * ========================= 4. EVERY SQUARE CAN BE POINTED AT =========================
 * The question this file was built to ask and did not, found the hard way on 2026-10-04: the
 * projected view's pointer maths floored its CSS-pixels-per-canvas-pixel ratio at 1, so once the
 * board was drawn SMALLER than its own raster every click resolved up and to the left. Clicking
 * the pawn on e2 selected nothing and moved the cursor to d4. Click-to-move was dead, and the
 * carry — which asks the same question to decide whether a press is on a piece — refused every
 * time, so drag-and-drop did nothing either. Two reports, one ratio.
 *
 * ⚠️ IT SWEEPS RATHER THAN AIMING, and the first version of this check aimed. Aiming needs a
 * ground truth for where each square is DRAWN, and the obvious candidate is wrong: the crossing of
 * a file label's x with a rank label's y is not the square's centre, because `ui/coordinates.ts`
 * pushes each label outward along ITS OWN square's outward direction, which has a horizontal
 * component. The other candidate is worse — the view's own debug helper converts canvas to CSS
 * with the SAME ratio the pointer uses, so a wrong ratio cancels itself and the test passes.
 *
 * A sweep needs no such truth. It only asks whether the board can be REACHED: drag the pointer
 * across the canvas and the squares it finds must come out in order, and must span all eight.
 * Under the defect only the left half of the board answered at all — the sweep stops at d and
 * never reaches h — which is exactly the failure a player meets.
 */
const cursorNow = (page) => page.evaluate(() => {
  const cell = document.querySelector('[data-square][tabindex="0"]');
  return cell ? cell.dataset.square : null;
});

/**
 * Clicks along a line and returns the squares it crossed, in order.
 *
 * ⚠️ THE LEADING STALE READING IS DROPPED, and getting that wrong made this check lie twice. The
 * sweep starts off the board, where a click changes nothing, so the first readings are just
 * wherever the cursor already was — and collecting them through a `Set` put that square FIRST in
 * the order, which read as "the files come out e,a,b,c,..." when they came out a,b,c,... The skip
 * stops at the first genuine change; after that every reading counts, including a later return to
 * the same square, because the sweep really does cross it.
 */
async function sweepSquares(page, from, to, steps) {
  const before = await cursorNow(page);
  const found = [];
  let moved = false;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    await page.mouse.down();
    await page.mouse.up();
    const landed = await cursorNow(page);
    if (!landed) continue;
    if (!moved) {
      if (landed === before) continue;
      moved = true;
    }
    if (found[found.length - 1] !== landed) found.push(landed);
  }
  return found;
}

/** The distinct values of one coordinate, in the order the sweep met them. */
const runOf = (squares, index) => {
  const out = [];
  for (const name of squares) {
    const part = name[index];
    if (out[out.length - 1] !== part) out.push(part);
  }
  return out.join('');
};

async function checkPointer(page, view, labels) {
  // The flat board is the DOM: its cells ARE the squares, so there is no projection to get wrong.
  if (!labels.length) return;

  const box = await page.evaluate(() => {
    const c = document.querySelector('#board-canvas, canvas.stage-3d');
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  });

  // Across the board at its middle height, and down it at its middle width. Both lines cross the
  // whole eight-by-eight whatever the camera is doing, at the default angle these views open at.
  const across = await sweepSquares(page, { x: box.left + 1, y: box.cy }, { x: box.right - 1, y: box.cy }, 70);
  const down = await sweepSquares(page, { x: box.cx, y: box.top + 1 }, { x: box.cx, y: box.bottom - 1 }, 70);

  const files = runOf(across, 0);
  const ranks = runOf(down, 1);

  if (files !== 'abcdefgh') {
    fail(`[${view}] sweeping across the board reaches files ${files || '(none)'}, not a..h — the pointer and the drawing disagree`);
  }
  if (ranks !== '87654321') {
    fail(`[${view}] sweeping down the board reaches ranks ${ranks || '(none)'}, not 8..1 — the pointer and the drawing disagree`);
  }
}


/*
 * ========================= ⚠️ QUESTION 5: WHAT THE 3D CANVAS ACTUALLY PRODUCES =========================
 * The Dev, 2026-10-04: "devolva as sombras para as peças dos tabuleiros de alto-contraste no
 * tabuleiro 3D." Giving them back means switching the lights on for the pieces — and a light
 * source is the one thing that can move a measured palette without anyone editing a hex value.
 *
 * ⚠️ I REASONED ABOUT THE SHADER FIRST AND GOT IT WRONG. Every square here shares one normal, so I
 * expected one multiplier on both and a ratio that barely moves. With the board lit, #ABABAB came
 * out as 173 and #5A5A5A as 91 — the dark square lifted 1.17× and the light one 1.03×, because the
 * tone curve compresses the top of the range — and the squares rendered at 2.77 against the 3.00
 * their inks hold. Under the floor, on the board that exists for the floor.
 *
 * So this reads the pixels. It is the only question in this file that cannot be answered from the
 * DOM, and it is the reason the other four are not enough: a canvas tells the accessibility tree
 * nothing at all.
 */
const LUM = (c) => {
  const f = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const RATIO = (a, bb) => {
  const [hi, lo] = [LUM(a), LUM(bb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

async function check3dInk(page) {
  // The high-contrast board, chosen through the panel exactly as a teacher would.
  const picked = await page.evaluate(() => {
    const box = [...document.querySelectorAll('.hud-controls .hud-field')]
      .find((f) => (f.textContent || '').includes('Cores do tabuleiro'));
    if (!box) return 'the board-colour control is not in the panel';
    const select = box.querySelector('select');
    if (![...select.options].some((o) => o.value === 'contrast-flat')) return 'contrast-flat is gone';
    select.value = 'contrast-flat';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.dispatchEvent(new FocusEvent('blur'));
    return 'ok';
  });
  if (picked !== 'ok') { fail(`[3D ink] ${picked}`); return; }
  await page.waitForTimeout(900);

  const tones = await page.evaluate(() => new Promise((resolve) => {
    const cv = document.querySelector('canvas.stage-3d');
    if (!cv) { resolve(null); return; }
    requestAnimationFrame(() => {
      const c = document.createElement('canvas');
      c.width = cv.width; c.height = cv.height;
      const g = c.getContext('2d');
      g.drawImage(cv, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const counts = new Map();
      for (let i = 0; i < d.length; i += 4) {
        const k = `${d[i]},${d[i + 1]},${d[i + 2]}`;
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      resolve([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24)
        .map(([k, n]) => ({ rgb: k.split(',').map(Number), n })));
    });
  }));
  if (!tones) { fail('[3D ink] no 3D canvas on the page'); return; }

  const has = (r, g, bl) => tones.some((t) => t.rgb[0] === r && t.rgb[1] === g && t.rgb[2] === bl);
  /*
   * ⚠️ THE SQUARES MUST RENDER AS THEIR INKS, to the byte. #ABABAB is 171 and #5A5A5A is 90, and
   * anything else means a light got at the board — which is what cost them the floor once already.
   */
  if (!has(171, 171, 171) || !has(90, 90, 90)) {
    const greys = tones.filter((t) => t.rgb[0] === t.rgb[1] && t.rgb[1] === t.rgb[2] && t.n > 5000);
    fail(`[3D ink] the high-contrast squares do not render as #ABABAB and #5A5A5A — the large flat `
      + `greys on the canvas are ${greys.map((t) => t.rgb[0]).join(', ')}, so something is lighting `
      + `the board; measured ratio ${RATIO([171, 171, 171], [90, 90, 90]).toFixed(2)} is only right `
      + `while those two bytes are what the canvas shows`);
  }
  /*
   * ⚠️ AND THE LIGHT PIECE MUST BE SPLIT ACROSS MORE THAN ONE LARGE TONE, which is the Dev's
   * "sombras". A white piece rendered flat means the lights were switched off again.
   *
   * ⚠️ 1500 PIXELS, AND THE NUMBER WAS MEASURED RATHER THAN CHOSEN. The first version of this
   * check counted tones above 300 px and stayed GREEN when the pieces were forced unlit, because
   * the canvas carries four unrelated mid-greys of about 700 px each — the plinth and the board's
   * own edges — and they answered the question instead of the pieces. Sampled both ways: lit, the
   * white pieces are 4672 px at 251 and 2738 at 172; unlit, they are 10141 px at 255 and nothing
   * else. Two tones over 1500 px is the line between those two pictures.
   */
  const pieceTones = tones.filter((t) => t.rgb[0] === t.rgb[1] && t.rgb[1] === t.rgb[2]
    && t.rgb[0] > 100 && t.rgb[0] !== 171 && t.rgb[0] !== 90 && t.n > 1500);
  if (pieceTones.length < 2) {
    fail(`[3D ink] the light pieces render as ${pieceTones.length} large tone(s) `
      + `(${pieceTones.map((t) => `${t.rgb[0]}×${t.n}`).join(', ')}): a lit solid is split across `
      + `at least two, or it is a flat shape and the lights are off`);
  }
  /*
   * ⚠️ AND EVERY ONE OF THOSE TONES OWES 3:1 TO THE BLACK EDGE AROUND IT. That edge is what lets
   * the body be lit at all — it is the boundary, so the body no longer owes the square anything —
   * and a tone that sinks into the edge takes the boundary away again.
   */
  for (const t of pieceTones) {
    const r = RATIO(t.rgb, [0, 0, 0]);
    if (r < 3) fail(`[3D ink] a lit piece tone rgb(${t.rgb.join(',')}) is ${r.toFixed(2)} from its `
      + `own black edge, under the 3:1 that edge needs to stay an edge`);
  }
}

const { server, port } = await serve();
const browser = await chromium.launch();
let status = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  page.on('pageerror', (error) => fail(`[page] uncaught: ${error.message}`));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });

  // Through the title screen by the PLAY door, the same way a child arrives.
  await page.getByRole('button', { name: 'JOGAR' }).click({ timeout: 30_000 });
  await page.locator('#chess-board').waitFor({ state: 'visible', timeout: 30_000 });

  for (const view of ['2D', '2,5D', '3D']) {
    await page.getByRole('button', { name: new RegExp(`em ${view.replace(',', ',')}$`) }).click();
    // One animation frame is not enough: the view tears down a renderer and builds another.
    await page.waitForTimeout(400);
    const m = await measure(page);
    judge(view, m);
    await checkPointer(page, view, m.labels);
    if (view === '3D') await check3dInk(page);
  }
} catch (error) {
  fail(`[driver] ${error.message}`);
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error(`\nRendered-page check: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error('');
  status = 1;
} else {
  console.log('Rendered-page check: targets, clipping, coordinates, the pointer and the 3D canvas\'s own pixels are right in all three views.');
}
process.exit(status);
