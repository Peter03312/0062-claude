import type { RouteDraft } from '../engine/types';
import { contentHash } from '../engine/examples';

// 纯前端离线持久化：草稿与结论快照只存浏览器 localStorage，不联网。

const DRAFT_KEY = 'braid-book:draft:v1';
const SNAPSHOTS_KEY = 'braid-book:snapshots:v1';
const VERDICT_KEY = 'braid-book:verdict:v1';

export interface BookState {
  n: number;
  routeA: RouteDraft;
  routeB: RouteDraft;
}

export interface Snapshot {
  id: string;
  name: string;
  savedAt: string;
  state: BookState;
}

export interface Verdict {
  /** 封存时输入内容的指纹；输入一变指纹即不符，结论立即失效。 */
  hash: string;
  sealedAt: string;
  report: string;
  equivalent: boolean;
  legal: boolean;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function stateHash(state: BookState): string {
  return contentHash({ n: state.n, a: state.routeA, b: state.routeB });
}

export function loadDraft(): BookState | null {
  if (typeof localStorage === 'undefined') return null;
  return safeParse<BookState | null>(localStorage.getItem(DRAFT_KEY), null);
}

export function saveDraft(state: BookState): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
}

export function loadSnapshots(): Snapshot[] {
  return safeParse<Snapshot[]>(localStorage.getItem(SNAPSHOTS_KEY), []);
}

export function saveSnapshot(name: string, state: BookState): Snapshot[] {
  const snaps = loadSnapshots();
  const snap: Snapshot = {
    id: `snap-${Date.now().toString(36)}`,
    name: name.trim() || `备份 ${snaps.length + 1}`,
    savedAt: new Date().toISOString(),
    state
  };
  const next = [snap, ...snaps].slice(0, 20);
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next));
  return next;
}

export function deleteSnapshot(id: string): Snapshot[] {
  const next = loadSnapshots().filter((s) => s.id !== id);
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next));
  return next;
}

export function loadVerdict(): Verdict | null {
  return safeParse<Verdict | null>(localStorage.getItem(VERDICT_KEY), null);
}

export function sealVerdict(v: Verdict): void {
  localStorage.setItem(VERDICT_KEY, JSON.stringify(v));
}

export function clearVerdict(): void {
  localStorage.removeItem(VERDICT_KEY);
}
