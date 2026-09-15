import type { Generator, RuleSpec, Word } from './types';

// 在“父词”上局部复现一条公理改写，并与用户声称的子词核对。
// 片段一律使用半开区间 [start,end) 的生成元索引（从 0 起）。

export interface RewriteOk {
  ok: true;
  expected: Word;
}

export interface RewriteErr {
  ok: false;
  code: 'segment-out-of-range' | 'rule-param' | 'wrong-axiom';
  /** 首个问题索引（片段端点或片段内位置）。 */
  index: number;
  message: string;
}

export type RewriteResult = RewriteOk | RewriteErr;

const sameGen = (a: Generator, b: Generator) => a.i === b.i && a.inv === b.inv;

function segmentOutOfRange(parent: Word, start: number, end: number): RewriteErr | null {
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return {
      ok: false,
      code: 'segment-out-of-range',
      index: Number.isInteger(start) ? start : 0,
      message: '片段端点必须是整数（生成元索引，从 0 起）'
    };
  }
  if (start < 0 || start > parent.length) {
    return {
      ok: false,
      code: 'segment-out-of-range',
      index: Math.max(0, start),
      message: `片段起点 ${start} 越界：父词只有 ${parent.length} 个生成元（允许 0…${parent.length}）`
    };
  }
  if (end < start || end > parent.length) {
    return {
      ok: false,
      code: 'segment-out-of-range',
      index: Math.max(0, Math.min(end, parent.length)),
      message: `片段终点 ${end} 越界：必须满足 ${start} ≤ end ≤ ${parent.length}`
    };
  }
  return null;
}

function replaceSegment(parent: Word, start: number, end: number, middle: Word): Word {
  return [...parent.slice(0, start), ...middle, ...parent.slice(end)];
}

/**
 * 复现规则改写。
 * @param n 股数（用于校验插入参数 i 的合法范围 1…n−1）
 * @returns ok 时 expected 为父词按该公理改写后“应当得到”的词。
 */
export function applyRule(parent: Word, start: number, end: number, rule: RuleSpec, n: number): RewriteResult {
  const badRange = segmentOutOfRange(parent, start, end);
  if (badRange) return badRange;

  const seg = parent.slice(start, end);

  switch (rule.kind) {
    case 'cancel': {
      // 逆元相消：片段恰为 σi σi⁻¹ 或 σi⁻¹ σi，删除后长度应为父词长度 -2。
      if (seg.length !== 2) {
        return {
          ok: false,
          code: 'wrong-axiom',
          index: start,
          message: `逆元相消要求选中恰好 2 个相邻生成元，当前选中 ${seg.length} 个`
        };
      }
      const [a, b] = seg;
      if (a.i !== b.i || a.inv === b.inv) {
        return {
          ok: false,
          code: 'wrong-axiom',
          index: start,
          message: `片段 ${fmt(seg)} 不是相邻逆元对（应为 σi σi⁻¹ 或 σi⁻¹ σi）`
        };
      }
      return { ok: true, expected: replaceSegment(parent, start, end, []) };
    }

    case 'insert': {
      // 逆元插入：在 start 处插入 σi σi⁻¹（选空片段 start==end）。
      if (start !== end) {
        return {
          ok: false,
          code: 'wrong-axiom',
          index: start,
          message: '逆元插入应选空片段（起点等于终点，表示插入位置）'
        };
      }
      if (rule.i === null || rule.i < 1) {
        return {
          ok: false,
          code: 'rule-param',
          index: start,
          message: '逆元插入需要给出合法的正整数 i'
        };
      }
      if (rule.i > n - 1) {
        return {
          ok: false,
          code: 'rule-param',
          index: start,
          message: `插入的 σ${rule.i} 越界：${n} 股只允许 σ1…σ${n - 1}`
        };
      }
      const pair: Word = [
        { i: rule.i, inv: false },
        { i: rule.i, inv: true }
      ];
      return { ok: true, expected: replaceSegment(parent, start, end, pair) };
    }

    case 'commute': {
      // 远交换：片段恰为两个生成元 σi σj（含方向），且 |i-j| ≥ 2。
      if (seg.length !== 2) {
        return {
          ok: false,
          code: 'wrong-axiom',
          index: start,
          message: `远交换要求选中恰好 2 个生成元，当前选中 ${seg.length} 个`
        };
      }
      const [a, b] = seg;
      if (Math.abs(a.i - b.i) < 2) {
        return {
          ok: false,
          code: 'wrong-axiom',
          index: start + 1,
          message: `σ${a.i} 与 σ${b.i} 下标差为 ${Math.abs(a.i - b.i)}，不满足远交换 |i−j| ≥ 2（相邻股不能交换）`
        };
      }
      return {
        ok: true,
        expected: replaceSegment(parent, start, end, [b, a])
      };
    }

    case 'braid': {
      // 辫关系（正生成元）：σi σi+1 σi ↔ σi+1 σi σi+1。
      if (seg.length !== 3) {
        return {
          ok: false,
          code: 'wrong-axiom',
          index: start,
          message: `辫关系要求选中恰好 3 个生成元，当前选中 ${seg.length} 个`
        };
      }
      if (seg.some((g) => g.inv)) {
        return {
          ok: false,
          code: 'wrong-axiom',
          index: start + seg.findIndex((g) => g.inv),
          message: '本论证册的辫关系只接受正生成元：σi σi+1 σi ↔ σi+1 σi σi+1（含逆元的形式请先用逆元相消/插入自行推导）'
        };
      }
      const seq = seg.map((g) => g.i);
      const a = seg[0].i;
      const lhs = [a, a + 1, a];
      const rhs = [a + 1, a, a + 1];
      let middle: Word | null = null;
      if (seq.every((v, k) => v === lhs[k])) {
        middle = rhs.map((i) => ({ i, inv: false }));
      } else if (seq.every((v, k) => v === rhs[k])) {
        middle = lhs.map((i) => ({ i, inv: false }));
      } else {
        return {
          ok: false,
          code: 'wrong-axiom',
          index: start,
          message: `片段 ${fmt(seg)} 不构成辫关系（应为 σi σi+1 σi 或 σi+1 σi σi+1，且三个下标连续）`
        };
      }
      return { ok: true, expected: replaceSegment(parent, start, end, middle) };
    }
  }
}

function fmt(word: Word): string {
  return word
    .map((g) => `σ${g.i}${g.inv ? '⁻¹' : ''}`)
    .join(' ');
}

/** 把“复现出的应得词”与“用户声称得到的词”逐字母核对。 */
export function diffWords(expected: Word, claimed: Word): { match: boolean; firstDiff: number } {
  const m = Math.min(expected.length, claimed.length);
  for (let k = 0; k < m; k++) {
    if (!sameGen(expected[k], claimed[k])) return { match: false, firstDiff: k };
  }
  if (expected.length !== claimed.length) return { match: false, firstDiff: m };
  return { match: true, firstDiff: -1 };
}
