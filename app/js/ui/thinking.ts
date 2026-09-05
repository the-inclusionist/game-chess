// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/thinking — what the engine is doing, under the board.
//
// ========================= WHY THIS IS WORTH SHOWING A CHILD =========================
// An opponent that thinks for a second and then moves is a black box, and a black box teaches
// nothing. The same second, narrated — "depth 12, it likes e2e4, it has looked at 91,000
// positions" — is the first honest picture most people ever get of what a chess engine actually
// does. It is also the answer to "is it broken?", which is otherwise unanswerable while it thinks.
//
// ========================= ⚠️ NOT A LIVE REGION =========================
// A UCI engine sends `info` lines many times a second. Announcing them would flood a screen reader
// with numbers nobody asked for and drown the move announcements that matter. This is `role=status`
// with `aria-live="off"`: readable on demand, silent by default. The move itself is still spoken by
// `srSay`, as it always was.
//
// The board's own thinking — our negamax — has nothing to narrate: it answers once, at the end. So
// this panel shows a result there and a running commentary under Stockfish, and says which.

import type { Thought } from '../chess/engine/uci.ts';
import type { I18n } from '../i18n/index.ts';

export interface ThinkingPanel {
  readonly root: HTMLElement;
  /** A new thought from the engine. Cheap enough to call on every `info` line. */
  update(thought: Thought): void;
  /** The engine has started or stopped. */
  setBusy(busy: boolean): void;
  clear(): void;
  refresh(): void;
  destroy(): void;
}

export interface ThinkingDeps {
  readonly doc: Document;
  readonly i18n: I18n;
}

/** Centipawns as a chess player reads them: pawns, signed, two decimals. */
export function formatScore(thought: Thought): string {
  if (thought.mate !== undefined) return thought.mate > 0 ? `#${thought.mate}` : `#${thought.mate}`;
  if (thought.score === undefined) return '—';
  const pawns = thought.score / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
}

/** Long algebraic run together is unreadable; spaced pairs are the score-sheet convention. */
export function formatLine(line: readonly string[] | undefined, limit = 6): string {
  if (!line?.length) return '—';
  return line.slice(0, limit).join(' ');
}

export function createThinkingPanel(deps: ThinkingDeps): ThinkingPanel {
  const { doc, i18n } = deps;

  const root = doc.createElement('section');
  root.className = 'thinking';
  root.setAttribute('role', 'status');
  // ⚠️ Off, on purpose. See the note at the top: `info` arrives many times a second.
  root.setAttribute('aria-live', 'off');

  const title = doc.createElement('h2');
  const state = doc.createElement('span');
  state.className = 'thinking-state';
  const fields = doc.createElement('dl');
  root.append(title, state, fields);

  const cell = (): { term: HTMLElement; value: HTMLElement } => {
    const term = doc.createElement('dt');
    const value = doc.createElement('dd');
    fields.append(term, value);
    return { term, value };
  };
  const depth = cell();
  const score = cell();
  const nodes = cell();
  const line = cell();

  let latest: Thought = {};
  let busy = false;

  function refresh(): void {
    title.textContent = i18n.t('hud.thinking');
    state.textContent = i18n.t(busy ? 'think.searching' : 'think.idle');
    state.dataset.busy = busy ? 'true' : '';

    depth.term.textContent = i18n.t('think.depth');
    depth.value.textContent = latest.depth === undefined ? '—' : String(latest.depth);

    score.term.textContent = i18n.t('think.score');
    score.value.textContent = formatScore(latest);

    nodes.term.textContent = i18n.t('think.nodes');
    nodes.value.textContent = latest.nodes === undefined
      ? '—'
      : latest.nodes.toLocaleString(i18n.bcp47());

    line.term.textContent = i18n.t('think.line');
    line.value.textContent = formatLine(latest.line);
  }

  refresh();

  return {
    root,

    update(thought) {
      // Merged rather than replaced: an `info` line carries only what changed, so a line with a
      // new depth and no node count does not mean the node count is gone.
      latest = { ...latest, ...thought };
      refresh();
    },

    setBusy(next) {
      busy = next;
      refresh();
    },

    clear() {
      latest = {};
      busy = false;
      refresh();
    },

    refresh,

    destroy() { root.remove(); },
  };
}
