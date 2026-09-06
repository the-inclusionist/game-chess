// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ========================= THE BAR THE USER ASKED FOR, IN SO MANY WORDS =========================
// "7MB é muito, mas muito pouco para que o download seja pulado. Por favor, permita baixar antes e
// só depois habilitar os botões, por padrão, com barra de progresso de download no rodapé."
//
// `chess/engine/preload.ts` is that bar. It takes an injectable `fetcher` — a seam put there
// deliberately so this could be tested without seven megabytes — and nothing had used it.
//
// ⚠️ AND A PROGRESS BAR IS ALL EDGE CASES. It is trivial while the network behaves and it is the
// only thing on screen when the network does not: a `content-length` a proxy disagrees with, a
// HEAD that answers nothing, a fetch that throws halfway. Every one of those has to leave a bar
// that still reaches its end, because the alternative is a child watching a screen that has
// stopped and being told nothing.
import { describe, expect, it } from 'vitest';
import { preloadEngine, type PreloadReport } from '../app/js/chess/engine/preload.ts';

/** A body that hands `chunks` over one read at a time, the way a real stream does. */
function stream(chunks: readonly number[]): ReadableStream<Uint8Array> {
  let at = 0;
  return new ReadableStream({
    pull(controller) {
      if (at >= chunks.length) { controller.close(); return; }
      controller.enqueue(new Uint8Array(chunks[at]!));
      at += 1;
    },
  });
}

interface Plan {
  /** Bytes each URL reports on HEAD. `null` makes the HEAD throw. */
  readonly head?: Record<string, number | null>;
  /** Chunk sizes each URL delivers on GET. `null` makes the GET throw. */
  readonly get?: Record<string, readonly number[] | null>;
  /** URLs whose response has no `body`, forcing the whole-buffer path. */
  readonly noBody?: readonly string[];
}

function fakeFetch(plan: Plan): { fetcher: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fetcher = (async (url: string, init?: { method?: string }) => {
    const head = init?.method === 'HEAD';
    calls.push(`${head ? 'HEAD' : 'GET'} ${url}`);
    if (head) {
      const size = plan.head?.[url];
      if (size === null) throw new Error('no HEAD here');
      return { headers: new Headers({ 'content-length': String(size ?? 0) }) };
    }
    const chunks = plan.get?.[url];
    if (chunks === null) throw new Error('the download failed');
    const bytes = chunks ?? [];
    if (plan.noBody?.includes(url)) {
      const total = bytes.reduce((sum, n) => sum + n, 0);
      return { body: null, arrayBuffer: async () => new ArrayBuffer(total) };
    }
    return { body: stream(bytes) };
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

const WASM = '/vendor/engine/stockfish-18-lite-single.wasm';
const GLUE = '/vendor/engine/stockfish-18-lite-single.js';

/** Runs a preload and keeps every report it made. */
async function run(plan: Plan): Promise<{ reports: PreloadReport[]; calls: string[] }> {
  const reports: PreloadReport[] = [];
  const { fetcher, calls } = fakeFetch(plan);
  await preloadEngine((report) => { reports.push(report); }, fetcher);
  return { reports, calls };
}

describe('[Preload] the bar moves, forwards, and gets to the end', () => {
  it('⚠️ never goes backwards, which is the one thing a bar must not do', async () => {
    /*
     * Stated in the type — "0 to 1. Never goes backwards" — and it is a claim about arithmetic
     * that nobody was checking. A bar that retreats reads as an error even when nothing is wrong.
     */
    const { reports } = await run({
      head: { [WASM]: 900, [GLUE]: 100 },
      get: { [WASM]: [300, 300, 300], [GLUE]: [50, 50] },
    });
    expect(reports.length).toBeGreaterThan(3);
    for (let i = 1; i < reports.length; i += 1) {
      expect(`${i}: ${reports[i]!.fraction >= reports[i - 1]!.fraction}`).toBe(`${i}: true`);
    }
  });

  it('starts at zero and finishes at exactly one', async () => {
    // The two ends are what a reader actually notices: a bar that begins part-full looks like it
    // resumed something, and one that stops at 0.98 looks stuck.
    const { reports } = await run({
      head: { [WASM]: 900, [GLUE]: 100 },
      get: { [WASM]: [900], [GLUE]: [100] },
    });
    expect(reports[0]!.fraction).toBe(0);
    expect(reports.at(-1)!.fraction).toBe(1);
  });

  it('asks for the sizes before it asks for the bytes', async () => {
    /*
     * Both HEADs first, so the bar is a proportion from its first movement rather than a guess
     * that jumps when the second file's size arrives. And the wasm before the glue, because the
     * order is what makes the bar move in the order that matters — 7 MB against a few kilobytes.
     */
    const { calls } = await run({
      head: { [WASM]: 900, [GLUE]: 100 },
      get: { [WASM]: [900], [GLUE]: [100] },
    });
    expect(calls.slice(0, 2)).toEqual([`HEAD ${WASM}`, `HEAD ${GLUE}`]);
    expect(calls.slice(2)).toEqual([`GET ${WASM}`, `GET ${GLUE}`]);
  });
});

describe('[Preload] the network misbehaving is the normal case, not the exception', () => {
  it('⚠️ falls back to a measured total when no HEAD answers', async () => {
    /*
     * A server that does not send `content-length` — or a HEAD it refuses outright — would leave
     * the total at zero and every fraction a division by it. The fallback is the measured size of
     * the real file, so the bar is approximately right rather than absent.
     */
    const { reports } = await run({
      head: { [WASM]: null, [GLUE]: null },
      get: { [WASM]: [1000], [GLUE]: [10] },
    });
    expect(reports[0]!.total).toBeGreaterThan(7_000_000);
    // And it still reaches the end, because the last report does not divide anything.
    expect(reports.at(-1)!.fraction).toBe(1);
  });

  it('⚠️ clamps at one when more arrives than content-length promised', async () => {
    /*
     * A proxy that recompresses on the way through reports one size and delivers another. Without
     * the clamp the bar runs past its own end, which is the one way a progress bar can be more
     * confusing than no progress bar.
     */
    const { reports } = await run({
      head: { [WASM]: 100, [GLUE]: 0 },
      get: { [WASM]: [400, 400], [GLUE]: [50] },
    });
    for (const report of reports) {
      expect(`${report.loaded}: ${report.fraction <= 1}`).toBe(`${report.loaded}: true`);
    }
    expect(reports.at(-1)!.fraction).toBe(1);
  });

  it('⚠️ never rejects, and leaves the bar full rather than stuck', async () => {
    /*
     * A failed preload is not a failed game — the worker will fetch the same URL itself, and the
     * splash has its own path for saying so if that fails too. What must not happen is a rejected
     * promise reaching a caller that has a button disabled behind it, or a bar frozen at a
     * fraction it will never leave while the download it describes is actually going fine.
     */
    const { reports } = await run({
      head: { [WASM]: 900, [GLUE]: 100 },
      get: { [WASM]: null },
    });
    await expect(run({ head: { [WASM]: null }, get: { [WASM]: null } })).resolves.toBeDefined();
    expect(reports.at(-1)!.fraction).toBe(1);
  });

  it('reads a response with no body in one step rather than not at all', async () => {
    // Not every fetch implementation streams. The whole-buffer path still warms the cache, which
    // is the point of the whole module, and still moves the bar — just once.
    const { reports } = await run({
      head: { [WASM]: 900, [GLUE]: 100 },
      get: { [WASM]: [900], [GLUE]: [100] },
      noBody: [WASM, GLUE],
    });
    expect(reports.at(-1)!.fraction).toBe(1);
    expect(reports.at(-1)!.loaded).toBe(1000);
  });
});
