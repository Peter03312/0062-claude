import type { Generator, Tuple, Word } from './types';
import { invFree, isFreeEqual, reduceFree } from './words';

// Artin（几何）表示：B_n -> Aut(F_n)，F_n 的基为 x1,…,xn。
//
// 题目给出的逐字母替换（置换作用从左到右作用到元组上）：
//   σ_i:   (x_i, x_{i+1}) -> (x_i x_{i+1} x_i^{-1}, x_i)
//   σ_i⁻¹: (x_i, x_{i+1}) -> (x_{i+1}, x_{i+1}^{-1} x_i x_{i+1})
// 其余分量不变。每次替换后反复约消相邻逆元。

export function initialTuple(n: number): Tuple {
  return Array.from({ length: n }, (_, k) => [k + 1]);
}

/** 把单个生成元作用到元组上（原地返回新元组；每个分量始终保持已约消）。 */
export function applyGenerator(t: Tuple, g: Generator): Tuple {
  const i = g.i; // 1-based，访问下标 i-1 与 i
  const xi = t[i - 1];
  const xj = t[i];
  const next = t.slice();
  if (!g.inv) {
    // (xi, xi+1) -> (xi xi+1 xi^-1, xi)
    next[i - 1] = reduceFree([...xi, ...xj, ...invFree(xi)]);
    next[i] = xi.slice();
  } else {
    // (xi, xi+1) -> (xi+1, xi+1^-1 xi xi+1)
    next[i - 1] = xj.slice();
    next[i] = reduceFree([...invFree(xj), ...xi, ...xj]);
  }
  return next;
}

/** 按词从左到右计算 Artin 自由群语义（置换作用）。 */
export function artinImage(word: Word, n: number): Tuple {
  let t = initialTuple(n);
  for (const g of word) {
    t = applyGenerator(t, g);
  }
  return t;
}

/** 由词直接求末端排列 p：股在第 k 个位置上的原编号（按作用顺序追踪）。 */
export function endpointPermutation(word: Word, n: number): number[] {
  const pos = Array.from({ length: n }, (_, k) => k + 1);
  for (const g of word) {
    const a = g.i - 1;
    const b = g.i;
    [pos[a], pos[b]] = [pos[b], pos[a]];
  }
  return pos;
}

/** 元组分量逐分量比较（自由群相等 = 约消后逐字母相同）。 */
export function tupleEqual(a: Tuple, b: Tuple): boolean {
  if (a.length !== b.length) return false;
  for (let k = 0; k < a.length; k++) {
    if (a[k].length !== b[k].length) return false;
    for (let m = 0; m < a[k].length; m++) if (a[k][m] !== b[k][m]) return false;
  }
  return true;
}

/** 第一个不同分量（1-based）；全等时返回 -1。 */
export function firstDifferentComponent(a: Tuple, b: Tuple): number {
  const m = Math.min(a.length, b.length);
  for (let k = 0; k < m; k++) {
    if (!isFreeEqual(a[k], b[k])) return k + 1;
  }
  return a.length === b.length ? -1 : m + 1;
}
