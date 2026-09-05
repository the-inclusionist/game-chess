// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createEngineClient } from '../app/js/chess/engine/client.ts';
import type { SearchReply, SearchRequest } from '../app/js/chess/engine/protocol.ts';

/**
 * A worker that never starts a thread. The client takes its factory as a parameter precisely so
 * this is possible: the interesting behaviour is all in how replies are matched and dropped, and
 * none of it needs a real search — or a browser.
 */
class FakeWorker {
  onmessage: ((event: MessageEvent<SearchReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly sent: SearchRequest[] = [];
  terminated = false;

  postMessage(request: SearchRequest): void { this.sent.push(request); }
  terminate(): void { this.terminated = true; }

  reply(partial: Partial<SearchReply> & { id: number }): void {
    const full: SearchReply = {
      move: { from: { x: 4, y: 6 }, to: { x: 4, y: 4 }, promotion: null },
      score: 12, nodes: 34, depth: 2, ...partial,
    };
    this.onmessage?.({ data: full } as MessageEvent<SearchReply>);
  }

  fail(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

function make() {
  const worker = new FakeWorker();
  const client = createEngineClient(() => worker as unknown as Worker);
  return { worker, client };
}

describe('[Request] the search is asked for, once', () => {
  it('sends the position and the depth', async () => {
    const { worker, client } = make();
    const promise = client.requestMove('some-fen', 3);
    expect(worker.sent).toHaveLength(1);
    expect(worker.sent[0].fen).toBe('some-fen');
    expect(worker.sent[0].depth).toBe(3);

    worker.reply({ id: worker.sent[0].id });
    await expect(promise).resolves.toMatchObject({ score: 12, nodes: 34 });
  });

  it('resolves with the move, in our own square vocabulary', async () => {
    const { worker, client } = make();
    const promise = client.requestMove('fen', 2);
    worker.reply({ id: worker.sent[0].id });
    const result = await promise;
    expect(result?.move.from).toEqual({ x: 4, y: 6 });
    expect(result?.move.to).toEqual({ x: 4, y: 4 });
  });

  it('resolves null when the position has no move', async () => {
    const { worker, client } = make();
    const promise = client.requestMove('fen', 2);
    worker.reply({ id: worker.sent[0].id, move: null });
    await expect(promise).resolves.toBeNull();
  });
});

describe('[Staleness] an answer to a question nobody is asking any more', () => {
  // The failure this prevents has no symptom of its own: a reply computed for a position that no
  // longer exists is still a LEGAL-LOOKING move, so the game would simply play something wrong.
  it('ignores a reply whose id it is not waiting for', async () => {
    const { worker, client } = make();
    const promise = client.requestMove('fen', 2);
    const realId = worker.sent[0].id;

    worker.reply({ id: realId + 999, score: -1 });   // from a search long abandoned
    worker.reply({ id: realId, score: 42 });

    await expect(promise).resolves.toMatchObject({ score: 42 });
  });

  it('supersedes an in-flight search rather than queueing behind it', async () => {
    const { worker, client } = make();
    const first = client.requestMove('position-a', 2);
    const second = client.requestMove('position-b', 2);

    // The first settles immediately as "nothing", so nothing is left hanging on it.
    await expect(first).resolves.toBeNull();
    expect(worker.sent.map((r) => r.fen)).toEqual(['position-a', 'position-b']);

    worker.reply({ id: worker.sent[1].id, score: 7 });
    await expect(second).resolves.toMatchObject({ score: 7 });
  });

  it('never reuses an id', () => {
    const { worker, client } = make();
    client.requestMove('a', 1);
    client.requestMove('b', 1);
    client.requestMove('c', 1);
    expect(new Set(worker.sent.map((r) => r.id)).size).toBe(3);
  });
});

describe('[Failure] the game is never left waiting forever', () => {
  it('rejects when the search reports an error', async () => {
    const { worker, client } = make();
    const promise = client.requestMove('fen', 2);
    worker.reply({ id: worker.sent[0].id, error: 'boom' });
    await expect(promise).rejects.toThrow('boom');
  });

  it('rejects when the worker itself fails', async () => {
    const { worker, client } = make();
    const promise = client.requestMove('fen', 2);
    worker.fail('worker exploded');
    await expect(promise).rejects.toThrow('worker exploded');
  });

  it('shrugs off a worker failure with nothing in flight', () => {
    const { worker } = make();
    expect(() => worker.fail('nobody is listening')).not.toThrow();
  });
});

describe('[Lifecycle] cancelling and shutting down', () => {
  it('cancel settles the pending search as nothing', async () => {
    const { client } = make();
    const promise = client.requestMove('fen', 3);
    client.cancel();
    await expect(promise).resolves.toBeNull();
  });

  it('cancel with nothing in flight is harmless', () => {
    const { client } = make();
    expect(() => client.cancel()).not.toThrow();
  });

  it('destroy terminates the thread', () => {
    const { worker, client } = make();
    client.destroy();
    expect(worker.terminated).toBe(true);
  });
});
