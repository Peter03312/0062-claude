import { describe, expect, it } from 'vitest';
import { applyGenerator, artinImage, endpointPermutation, firstDifferentComponent, tupleEqual } from '../src/engine/artin';
import { compareRoutes, validateRoute } from '../src/engine/validate';
import { applyRule } from '../src/engine/rules';
import { formatWord, invFree, isFreeEqual, mulFree, parseWord, reduceFree } from '../src/engine/words';
import type { RouteDraft, Tuple, Word } from '../src/engine/types';

const g = (i: number, inv = false): Word[number] => ({ i, inv });
const w = (...gs: [number, boolean?][]): Word => gs.map(([i, inv]) => g(i, inv ?? false));

describe('自由群约消', () => {
  it('反复约消相邻逆元（含嵌套触发）', () => {
    expect(reduceFree([1, 2, -2, -1])).toEqual([]);
    expect(reduceFree([1, 2, -2, 3, -3, -1])).toEqual([]);
    expect(reduceFree([1, 2, -1, -2])).toEqual([1, 2, -1, -2]); // 非相邻，不化简
    expect(reduceFree([1, -1, 2])).toEqual([2]);
  });

  it('乘法与逆元满足 a·a⁻¹ = 1', () => {
    const a = [1, 2, -3];
    expect(mulFree(a, invFree(a))).toEqual([]);
    expect(isFreeEqual(reduceFree([1, 1, -1]), [1])).toBe(true);
  });
});

describe('词法解析与越界定位', () => {
  it('识别多种写法与 Unicode 上标逆元', () => {
    const q = parseWord('σ1 σ2⁻¹ σ3inv, s1-1', 4);
    expect(q.word).toEqual([g(1), g(2, true), g(3, true), g(1, true)]);
    expect(parseWord('σ₁', 3).issue?.code).toBe('parse-token'); // 下标 Unicode 不是受支持写法
  });

  it('从左到右报告首个越界下标（n 股只能用 1..n-1）', () => {
    const p = parseWord('σ1 σ3 σ2', 3); // n=3 -> 最大 σ2
    expect(p.issue?.code).toBe('index-out-of-range');
    expect(p.issue?.index).toBe(1);
  });

  it('σ0 非法；超过 24 个生成元被拒', () => {
    expect(parseWord('σ0', 3).issue?.code).toBe('parse-token');
    const long = Array(25).fill('σ1').join(' ');
    expect(parseWord(long, 3).issue?.code).toBe('word-too-long');
  });
});

describe('Artin 自由群语义（题目给定的逐字母替换）', () => {
  it('σ1: (x1,x2) -> (x1 x2 x1⁻¹, x1)', () => {
    const t = applyGenerator([[1], [2], [3]], g(1));
    expect(t).toEqual([[1, 2, -1], [1], [3]]);
  });

  it('σ1⁻¹: (x1,x2) -> (x2, x2⁻¹ x1 x2)', () => {
    const t = applyGenerator([[1], [2], [3]], g(1, true));
    expect(t).toEqual([[2], [-2, 1, 2], [3]]);
  });

  it('替换后反复约消：σ1 σ1⁻¹ 使元组回到初始（每分量相邻逆元消尽）', () => {
    const t = artinImage(w([1], [1, true]), 3);
    expect(t).toEqual([[1], [2], [3]]);
  });

  it('σ1σ2σ1 与 σ2σ1σ2 的自由群元组逐分量相等（辫关系是 Artin 表示中的等式）', () => {
    const a = artinImage(w([1], [2], [1]), 3);
    const b = artinImage(w([2], [1], [2]), 3);
    expect(tupleEqual(a, b)).toBe(true);
    expect(a).toEqual([
      [1, 2, 3, -2, -1],
      [1, 2, -1],
      [1]
    ]);
  });

  it('远交换：σ1σ3 与 σ3σ1 的元组相等（n=4，|1-3|≥2）', () => {
    expect(tupleEqual(artinImage(w([1], [3]), 4), artinImage(w([3], [1]), 4))).toBe(true);
  });

  it('远交换允许带方向的生成元：σ1 σ3⁻¹ -> σ3⁻¹ σ1', () => {
    const r = applyRule(w([1], [3, true]), 0, 2, { kind: 'commute', i: null, j: null }, 4);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.expected).toEqual([g(3, true), g(1)]);
  });
});

describe('同排列非等价反例：σ1² 与 σ2²（n=3）', () => {
  const a = w([1], [1]);
  const b = w([2], [2]);

  it('末端排列相同（都是恒等排列）', () => {
    expect(endpointPermutation(a, 3)).toEqual(endpointPermutation(b, 3));
    expect(endpointPermutation(a, 3)).toEqual([1, 2, 3]);
  });

  it('自由群元组不同，首个不同分量为第 1 个——不得仅按排列判等', () => {
    const ta = artinImage(a, 3);
    const tb = artinImage(b, 3);
    expect(tupleEqual(ta, tb)).toBe(false);
    expect(firstDifferentComponent(ta, tb)).toBe(1);
    expect(ta).toEqual([
      [1, 2, 1, -2, -1],
      [1, 2, -1],
      [3]
    ]);
    expect(tb).toEqual([
      [1],
      [2, 3, 2, -3, -2],
      [2, 3, -2]
    ]);
  });

  it('σ1σ2 与 σ2σ1 的排列确实不同（防止把错误反例写进页面）', () => {
    const pa = endpointPermutation(w([1], [2]), 3);
    const pb = endpointPermutation(w([2], [1]), 3);
    expect(pa).toEqual([2, 3, 1]);
    expect(pb).toEqual([3, 1, 2]);
  });
});

describe('整路线核查（局部改写复现）', () => {
  const mkStep = (
    parent: string,
    wordText: string,
    start: number,
    end: number,
    kind: 'cancel' | 'insert' | 'commute' | 'braid',
    i: number | null = null
  ) => ({
    id: `${kind}-${Math.random().toString(36).slice(2)}`,
    parent,
    wordText,
    start: String(start),
    end: String(end),
    rule: { kind, i, j: null as number | null }
  });

  it('插入越界下标（n=3 插 σ4）被 rule-param 拦下', () => {
    const route: RouteDraft = {
      name: 'A',
      rootText: '',
      steps: [{ ...mkStep('', 'σ4 σ4⁻¹', 0, 0, 'insert', 4), id: 'badins' }]
    };
    const v = validateRoute(route, 3);
    expect(v.legal).toBe(false);
    expect(v.results[0].issue?.code).toBe('rule-param');
    expect(v.results[0].issue?.message).toContain('越界');
  });

  it('插入后下一步再相消：σ1 -> σ1 σ2 σ2⁻¹ -> σ1，两步线性链合法', () => {
    const s1 = { ...mkStep('', 'σ1 σ2 σ2⁻¹', 1, 1, 'insert', 2), id: 'i1' };
    const s2 = { ...mkStep('i1', 'σ1', 1, 3, 'cancel'), id: 'i2' };
    const route: RouteDraft = { name: 'A', rootText: 'σ1', steps: [s1, s2] };
    const v = validateRoute(route, 3);
    expect(v.legal).toBe(true);
    expect(v.finalWord).toEqual([g(1)]);
  });

  it('逆元相消：σ1 σ1⁻¹ -> 空词，合法', () => {
    const id = 's1';
    const route: RouteDraft = {
      name: 'A',
      rootText: 'σ1 σ1⁻¹',
      steps: [{ ...mkStep('', '', 0, 2, 'cancel'), id }]
    };
    const v = validateRoute(route, 3);
    expect(v.legal).toBe(true);
    expect(v.finalWord).toEqual([]);
  });

  it('逆元插入：在空词位置 0 插入 σ2 σ2⁻¹', () => {
    const route: RouteDraft = {
      name: 'A',
      rootText: '',
      steps: [{ ...mkStep('', 'σ2 σ2⁻¹', 0, 0, 'insert', 2), id: 'ins' }]
    };
    const v = validateRoute(route, 3);
    expect(v.legal).toBe(true);
    expect(formatWord(v.finalWord)).toContain('σ');
  });

  it('远交换：σ1 σ3 -> σ3 σ1 合法（n=4）', () => {
    const route: RouteDraft = {
      name: 'A',
      rootText: 'σ1 σ3',
      steps: [{ ...mkStep('', 'σ3 σ1', 0, 2, 'commute'), id: 'c' }]
    };
    expect(validateRoute(route, 4).legal).toBe(true);
  });

  it('相邻下标不能远交换：σ1 σ2 被错误公理拦下，索引指向片段', () => {
    const route: RouteDraft = {
      name: 'A',
      rootText: 'σ1 σ2',
      steps: [{ ...mkStep('', 'σ2 σ1', 0, 2, 'commute'), id: 'c' }]
    };
    const v = validateRoute(route, 3);
    expect(v.legal).toBe(false);
    expect(v.results[0].issue?.code).toBe('wrong-axiom');
    expect(v.results[0].issue?.message).toContain('远交换');
  });

  it('辫关系：σ1 σ2 σ1 -> σ2 σ1 σ2 合法', () => {
    const route: RouteDraft = {
      name: 'A',
      rootText: 'σ1 σ2 σ1',
      steps: [{ ...mkStep('', 'σ2 σ1 σ2', 0, 3, 'braid', 1), id: 'b' }]
    };
    expect(validateRoute(route, 3).legal).toBe(true);
  });

  it('辫关系拒绝不构成模式的片段', () => {
    const route: RouteDraft = {
      name: 'A',
      rootText: 'σ1 σ1 σ1',
      steps: [{ ...mkStep('', 'σ2 σ1 σ2', 0, 3, 'braid', 1), id: 'b' }]
    };
    const v = validateRoute(route, 3);
    expect(v.legal).toBe(false);
    expect(v.results[0].issue?.code).toBe('wrong-axiom');
  });

  it('片段越界：[2,4) 超出 3 字母父词，报告越界', () => {
    const route: RouteDraft = {
      name: 'A',
      rootText: 'σ1 σ2 σ1',
      steps: [{ ...mkStep('', 'σ1', 2, 4, 'cancel'), id: 'x' }]
    };
    const v = validateRoute(route, 3);
    expect(v.results[0].issue?.code).toBe('segment-out-of-range');
  });

  it('断裂前序：第 2 步未指向紧邻的第 1 步', () => {
    const s1 = { ...mkStep('', 'σ2 σ1 σ2', 0, 3, 'braid', 1), id: 's1' };
    const s2 = { ...mkStep('不相关', 'σ1 σ2 σ1', 0, 3, 'braid', 1), id: 's2' };
    const route: RouteDraft = { name: 'A', rootText: 'σ1 σ2 σ1', steps: [s1, s2] };
    const v = validateRoute(route, 3);
    expect(v.legal).toBe(false);
    expect(v.results[1].issue?.code).toBe('broken-parent');
    expect(v.results[2]).toBeUndefined();
  });

  it('所写结果与公理应得不一致 -> word-mismatch，并给首个差异位置', () => {
    const route: RouteDraft = {
      name: 'A',
      rootText: 'σ1 σ1⁻¹',
      steps: [{ ...mkStep('', 'σ2', 0, 2, 'cancel'), id: 'm' }]
    };
    const v = validateRoute(route, 3);
    expect(v.results[0].issue?.code).toBe('word-mismatch');
    expect(v.results[0].issue?.index).toBe(0);
  });
});

describe('compareRoutes：端到端等价判定', () => {
  it('辫关系两侧（一步改写 vs 另一端零步）判定等价', () => {
    const a: RouteDraft = {
      name: 'A',
      rootText: 'σ1 σ2 σ1',
      steps: [
        {
          id: 'b1',
          parent: '',
          wordText: 'σ2 σ1 σ2',
          start: '0',
          end: '3',
          rule: { kind: 'braid' as const, i: 1, j: null }
        }
      ]
    };
    const b: RouteDraft = { name: 'B', rootText: 'σ2 σ1 σ2', steps: [] };
    const va = validateRoute(a, 3);
    const vb = validateRoute(b, 3);
    const cmp = compareRoutes(va, vb, 3, a.steps, b.steps);
    expect(cmp.legal).toBe(true);
    expect(cmp.equivalent).toBe(true);
    expect(cmp.samePermutation).toBe(true);
  });

  it('反例：两条零步路线同排列但不等价，报告第 1 个不同分量', () => {
    const a: RouteDraft = { name: 'A', rootText: 'σ1 σ1', steps: [] };
    const b: RouteDraft = { name: 'B', rootText: 'σ2 σ2', steps: [] };
    const va = validateRoute(a, 3);
    const vb = validateRoute(b, 3);
    const cmp = compareRoutes(va, vb, 3, [], []);
    expect(cmp.legal).toBe(true);
    expect(cmp.samePermutation).toBe(true);
    expect(cmp.equivalent).toBe(false);
    expect(cmp.firstDiffComponent).toBe(1);
  });

  it('任一路线不合法时不下等价结论', () => {
    const a: RouteDraft = { name: 'A', rootText: 'σ1 σ2', steps: [] };
    const b: RouteDraft = {
      name: 'B',
      rootText: 'σ1 σ2',
      steps: [
        {
          id: 'bad',
          parent: '',
          wordText: 'σ2 σ1',
          start: '0',
          end: '2',
          rule: { kind: 'commute' as const, i: null, j: null }
        }
      ]
    };
    const va = validateRoute(a, 3);
    const vb = validateRoute(b, 3);
    const cmp = compareRoutes(va, vb, 3, [], b.steps);
    expect(cmp.legal).toBe(false);
    expect(cmp.equivalent).toBe(false);
  });
});

describe('额外语义检查：Artin 像的分量始终是已约消自由群词', () => {
  it('长词作用后无任何分量含相邻逆元', () => {
    const t: Tuple = artinImage(
      w([1], [2, true], [1], [1, true], [2], [1]),
      3
    );
    for (const fw of t) {
      for (let k = 1; k < fw.length; k++) expect(fw[k - 1]).not.toBe(-fw[k]);
    }
  });
});
