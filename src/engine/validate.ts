import type {
  Comparison,
  RouteDraft,
  RouteValidation,
  StepIssue,
  StepResult
} from './types';
import { artinImage, endpointPermutation, firstDifferentComponent, tupleEqual } from './artin';
import { applyRule, diffWords } from './rules';
import { formatWord, parseWord } from './words';

// —— 单条路线核查 ------------------------------------------------------------
//
// 路线必须是线性链：第 0 步的前序是起始词（parent === ''），
// 第 k（k≥1）步的前序必须恰好是第 k-1 步（parent === steps[k-1].id）。
// 首个不满足处即“断裂前序”。

function parseInt10(raw: string): number {
  const t = raw.trim();
  if (!/^[+-]?\d+$/.test(t)) return NaN;
  return Number(t);
}

export function validateRoute(route: RouteDraft, n: number): RouteValidation {
  const rootParsed = parseWord(route.rootText, n);
  const results: StepResult[] = [];

  if (rootParsed.issue) {
    // 起始词不合法：所有步骤无从核对，全部标记跳过。
    for (const s of route.steps) {
      results.push({ id: s.id, status: 'skipped', derivedWord: [], issue: null });
    }
    return {
      rootWord: rootParsed.word,
      rootIssue: rootParsed.issue,
      results,
      legal: false,
      finalWord: rootParsed.word
    };
  }

  let current = rootParsed.word;
  let chainAlive = true;

  for (let k = 0; k < route.steps.length; k++) {
    const s = route.steps[k];
    const expectedParentId = k === 0 ? '' : route.steps[k - 1].id;

    // 1) 断裂前序（线性链被破坏，或指向不存在的步骤）
    if (s.parent !== expectedParentId || (k > 0 && !route.steps.some((q) => q.id === s.parent))) {
      const issue: StepIssue =
        s.parent !== expectedParentId
          ? {
              code: 'broken-parent',
              index: k,
              message:
                k === 0
                  ? '第 1 步的前一步必须是起始词（前序应留空）'
                  : `第 ${k + 1} 步的前一步应为紧邻的第 ${k} 步（${route.steps[k - 1].id}），实际指向 “${s.parent || '起始词'}”——线性论证在此断裂`
            }
          : {
              code: 'broken-parent',
              index: k,
              message: `第 ${k + 1} 步指向的前一步 “${s.parent}” 不存在——线性论证在此断裂`
            };
      results.push({ id: s.id, status: 'error', derivedWord: current, issue });
      chainAlive = false;
      break;
    }

    // 2) 在父词上复现公理改写（片段越界 / 公理用错在此暴露）
    const start = parseInt10(s.start);
    const end = parseInt10(s.end);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      results.push({
        id: s.id,
        status: 'error',
        derivedWord: current,
        issue: {
          code: 'segment-out-of-range',
          index: Number.isNaN(start) ? 0 : start,
          message: `第 ${k + 1} 步的片段端点不是整数：“${Number.isNaN(start) ? s.start : s.end}”`
        }
      });
      chainAlive = false;
      break;
    }

    const rewrite = applyRule(current, start, end, s.rule, n);
    if (!rewrite.ok) {
      results.push({
        id: s.id,
        status: 'error',
        derivedWord: current,
        issue: {
          code: rewrite.code,
          index: rewrite.index,
          message: `第 ${k + 1} 步：${rewrite.message}`
        }
      });
      chainAlive = false;
      break;
    }

    // 3) 解析本步声称得到的词
    const claimedParsed = parseWord(s.wordText, n);
    if (claimedParsed.issue) {
      results.push({
        id: s.id,
        status: 'error',
        derivedWord: rewrite.expected,
        issue: {
          code: claimedParsed.issue.code,
          index: claimedParsed.issue.index,
          message: `第 ${k + 1} 步所得词：${claimedParsed.issue.message}`
        }
      });
      chainAlive = false;
      break;
    }

    // 4) 声称的词必须与公理应得结果逐字母一致
    const d = diffWords(rewrite.expected, claimedParsed.word);
    if (!d.match) {
      const where =
        d.firstDiff < rewrite.expected.length && d.firstDiff < claimedParsed.word.length
          ? `第 ${d.firstDiff + 1} 个生成元不同：公理给出 ${formatWord(
              rewrite.expected
            )}，所写为 ${formatWord(claimedParsed.word)}`
          : `词尾长度不符：公理给出 ${formatWord(rewrite.expected)}（${rewrite.expected.length} 个生成元），所写为 ${formatWord(
              claimedParsed.word
            )}（${claimedParsed.word.length} 个生成元）`;
      results.push({
        id: s.id,
        status: 'error',
        derivedWord: rewrite.expected,
        issue: {
          code: 'word-mismatch',
          index: d.firstDiff,
          message: `第 ${k + 1} 步的结果与所选公理不符。${where}`
        }
      });
      chainAlive = false;
      break;
    }

    results.push({ id: s.id, status: 'ok', derivedWord: rewrite.expected, issue: null });
    current = rewrite.expected;
  }

  // 链在某一步中断后，后续步骤一律跳过（避免对错误前提继续下结论）
  for (let k = results.length; k < route.steps.length; k++) {
    results.push({ id: route.steps[k].id, status: 'skipped', derivedWord: current, issue: null });
  }

  return {
    rootWord: rootParsed.word,
    rootIssue: null,
    results,
    legal: chainAlive && results.every((r) => r.status !== 'error'),
    finalWord: current
  };
}

// —— 两条合法路线的比较 ------------------------------------------------------

export function compareRoutes(
  va: RouteValidation,
  vb: RouteValidation,
  n: number,
  stepsA: { id: string }[],
  stepsB: { id: string }[]
): Comparison {
  const firstStops: [number, string][] = [];
  if (!va.legal) {
    if (va.rootIssue) firstStops.push([0, `起始词：${va.rootIssue.message}`]);
    const bad = va.results.find((r) => r.status === 'error');
    if (bad) {
      const k = stepsA.findIndex((s) => s.id === bad.id);
      firstStops.push([k + 1, bad.issue ? bad.issue.message : '核查失败']);
    }
  }
  if (!vb.legal) {
    if (vb.rootIssue) firstStops.push([0, `起始词：${vb.rootIssue.message}`]);
    const bad = vb.results.find((r) => r.status === 'error');
    if (bad) {
      const k = stepsB.findIndex((s) => s.id === bad.id);
      firstStops.push([k + 1, bad.issue ? bad.issue.message : '核查失败']);
    }
  }

  // 任一路线不合法时，不算 Artin 语义（越界下标会落在元组之外），也绝不下等价结论。
  const legal = va.legal && vb.legal;
  const tupleA = legal ? artinImage(va.finalWord, n) : [];
  const tupleB = legal ? artinImage(vb.finalWord, n) : [];
  const permA = legal ? endpointPermutation(va.finalWord, n) : [];
  const permB = legal ? endpointPermutation(vb.finalWord, n) : [];
  const samePermutation = legal && permA.every((v, k) => v === permB[k]);
  const equivalent = legal && tupleEqual(tupleA, tupleB);

  return {
    legal,
    firstStops,
    wordA: va.finalWord,
    wordB: vb.finalWord,
    permA,
    permB,
    samePermutation,
    tupleA,
    tupleB,
    equivalent,
    firstDiffComponent: firstDifferentComponent(tupleA, tupleB)
  };
}
