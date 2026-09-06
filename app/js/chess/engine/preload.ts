// SPDX-License-Identifier: AGPL-3.0-or-later
// chess/engine/preload — fetches the opponent where the progress can be seen.
//
// ========================= WHY THIS EXISTS AT ALL =========================
// The engine is 7.3 MB of WebAssembly, and NOTHING WAS TELLING ANYBODY. The worker fetches it
// itself, from inside itself, so the page had no number to show: the splash could say "loading"
// and nothing more, for as long as the connection took. On a school connection that is a screen
// that looks broken.
//
// ⚠️ SO THE FILE IS FETCHED TWICE, ON PURPOSE, AND THE SECOND ONE IS FREE. This warms the HTTP
// cache with a fetch we can read a byte count from; the worker then asks for the same URL and gets
// it out of the cache. That is the whole trick, and it depends on the file being cacheable — which
// a static asset served by any of the three ways this game is served is.
//
// If the cache misses, nothing breaks: the worker downloads it the way it always did, and the only
// cost is the bar having told the truth about a download that then happened again. Worth stating
// because it is the failure mode, and it is a slow page rather than a broken one.

/** The two files the worker needs, largest first so the bar moves in the order it matters. */
const PARTS: readonly string[] = [
  '/vendor/engine/stockfish-18-lite-single.wasm',
  '/vendor/engine/stockfish-18-lite-single.js',
];

/** What the wasm weighs, for when the server does not say. Measured: 7,295,411 bytes. */
const ASSUMED_TOTAL = 7_316_840;

export interface PreloadReport {
  /** 0 to 1. Never goes backwards. */
  readonly fraction: number;
  readonly loaded: number;
  readonly total: number;
}

/**
 * Downloads the opponent, reporting as it goes.
 *
 * ⚠️ IT NEVER REJECTS. A failed preload is not a failed game: the worker will try the same URL
 * itself, and if that fails too the splash already has a path for saying so. Rejecting here would
 * put a second, earlier failure in front of a player for a download that had not actually been
 * attempted in earnest yet.
 */
export async function preloadEngine(
  onProgress: (report: PreloadReport) => void,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  let loaded = 0;
  let total = 0;

  // Sizes first, so the bar is a proportion from its first movement rather than a guess that
  // jumps. A HEAD is a few hundred bytes against seven megabytes.
  for (const url of PARTS) {
    try {
      const head = await fetcher(url, { method: 'HEAD' });
      total += Number(head.headers.get('content-length') ?? 0);
    } catch { /* counted below */ }
  }
  if (total === 0) total = ASSUMED_TOTAL;
  onProgress({ fraction: 0, loaded: 0, total });

  for (const url of PARTS) {
    try {
      const response = await fetcher(url);
      const body = response.body;
      if (!body) {
        // No streaming here — read it whole, which still warms the cache and still moves the bar,
        // just in one step.
        loaded += (await response.arrayBuffer()).byteLength;
        onProgress({ fraction: Math.min(1, loaded / total), loaded, total });
        continue;
      }
      const reader = body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value?.byteLength ?? 0;
        // ⚠️ Clamped at 1. A `content-length` that disagrees with what arrives — a proxy that
        // recompresses, most often — would otherwise drive the bar past its own end.
        onProgress({ fraction: Math.min(1, loaded / total), loaded, total });
      }
    } catch {
      // See above: the worker is still going to try. Move the bar on so it does not appear stuck
      // at a fraction it will never leave.
      loaded = total;
      onProgress({ fraction: 1, loaded, total });
      return;
    }
  }
  onProgress({ fraction: 1, loaded: total, total });
}
