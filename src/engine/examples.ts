import type { AxiomKind, ProofStepDraft, RouteDraft } from './types';

// 轻量 id，用于步骤节点与前序连接。
let counter = 0;
export function uid(prefix = 'step'): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}${Date.now().toString(36).slice(-3)}`;
}

export function makeStep(parent: string): ProofStepDraft {
  return {
    id: uid(),
    parent,
    wordText: '',
    start: '0',
    end: '2',
    rule: { kind: 'cancel', i: null, j: null }
  };
}

export const AXIOM_LABELS: Record<AxiomKind, string> = {
  cancel: '逆元相消 σiσi⁻¹ = 1',
  insert: '逆元插入 1 = σiσi⁻¹',
  commute: '远交换 σiσj = σjσi（|i−j|≥2）',
  braid: '辫关系 σiσi+1σi = σi+1σiσi+1'
};

export interface Example {
  key: string;
  title: string;
  n: number;
  routeA: RouteDraft;
  routeB: RouteDraft;
}

function step(
  parent: string,
  wordText: string,
  start: number,
  end: number,
  kind: AxiomKind,
  i: number | null = null
): ProofStepDraft {
  return {
    id: uid('ex'),
    parent,
    wordText,
    start: String(start),
    end: String(end),
    rule: { kind, i, j: null }
  };
}

/** 内置示例：覆盖三类公理与“同排列≠等价”反例。 */
export function buildExamples(): Example[] {
  // 例 1：辫关系改写 σ1σ2σ1 -> σ2σ1σ2（等价；路线 B 直接是另一端，零步）。
  const ex1Braid = step('', 'σ2 σ1 σ2', 0, 3, 'braid', 1);
  const ex1: Example = {
    key: 'braid-eq',
    title: '例 1：辫关系改写（等价）',
    n: 3,
    routeA: { name: '路线 A', rootText: 'σ1 σ2 σ1', steps: [ex1Braid] },
    routeB: { name: '路线 B', rootText: 'σ2 σ1 σ2', steps: [] }
  };

  // 例 2：反例 σ1² 与 σ2² —— 末端排列都是恒等，自由群像却不同。
  const ex2: Example = {
    key: 'same-perm',
    title: '例 2：同排列但不等价（反例 σ1² vs σ2²）',
    n: 3,
    routeA: { name: '路线 A', rootText: 'σ1 σ1', steps: [] },
    routeB: { name: '路线 B', rootText: 'σ2 σ2', steps: [] }
  };

  // 例 3：相消 + 远交换，两侧都化成 σ1。
  // A: σ1 σ3 σ3⁻¹ --相消[1,3)--> σ1
  // B: σ3 σ1 σ3⁻¹ --远交换[0,2)--> σ1 σ3 σ3⁻¹ --相消[1,3)--> σ1
  const b1 = step('', 'σ1 σ3 σ3⁻¹', 0, 2, 'commute');
  const b2 = step(b1.id, 'σ1', 1, 3, 'cancel');
  const ex3: Example = {
    key: 'cancel-commute',
    title: '例 3：相消 + 远交换（等价）',
    n: 4,
    routeA: {
      name: '路线 A',
      rootText: 'σ1 σ3 σ3⁻¹',
      steps: [step('', 'σ1', 1, 3, 'cancel')]
    },
    routeB: { name: '路线 B', rootText: 'σ3 σ1 σ3⁻¹', steps: [b1, b2] }
  };

  // 例 4：逆元插入 + 相消演示（n=3）。
  // A: σ1 --插入 σ2σ2⁻¹ 于位置 1--> σ1 σ2 σ2⁻¹ --相消[1,3)--> σ1（零步路线 B 就是 σ1）
  const a1 = step('', 'σ1 σ2 σ2⁻¹', 1, 1, 'insert', 2);
  const a2 = step(a1.id, 'σ1', 1, 3, 'cancel');
  const ex4: Example = {
    key: 'insert-demo',
    title: '例 4：插入后再相消（等价）',
    n: 3,
    routeA: { name: '路线 A', rootText: 'σ1', steps: [a1, a2] },
    routeB: { name: '路线 B', rootText: 'σ1', steps: [] }
  };

  return [ex1, ex2, ex3, ex4];
}

/** FNV-1a 32 位内容指纹：结论快照随输入内容失效，杜绝“固定结论”。 */
export function contentHash(value: unknown): string {
  const str = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let k = 0; k < str.length; k++) {
    h ^= str.charCodeAt(k);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
