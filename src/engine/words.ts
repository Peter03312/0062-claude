import type { FreeWord, Generator, StepIssue, Tuple, Word } from './types';

// —— 词法：σi / σi⁻¹ 的文本表示 ---------------------------------------------
//
// 接受的写法（分隔符为空白或逗号，大小写均可）：
//   s1, S1, σ1        σ_1
//   s1^-1, s1-1, s1inv, σ1⁻¹（用上标字符 ⁻¹）
// 也接受省略 sigma 前缀的纯数字： 1 2 1^-1
// 逆元标记：-1 指数、inv 后缀、或 Unicode 上标 ⁻¹。

const SUP_PREFIX = '⁻'; // ⁻
const SUP_ONE = '¹';

export function normalizeInput(text: string): string {
  return (
    text
      .replace(/σ/g, 's')
      .replace(/Σ/g, 's')
      // 上标 ⁻¹ -> 普通的 -1
      .replace(new RegExp(SUP_PREFIX + SUP_ONE, 'g'), '^-1')
      // 单个上标减号 / 上标数字（如 ²³）暂不支持，保持原样以便报错
      .toLowerCase()
  );
}

function parseToken(raw: string): Generator | { error: true } {
  let t = raw.trim();
  if (!t) return { error: true };

  // 识别逆元：^-1 / 尾随 -1 / inv 后缀
  let inv = false;
  if (/\^-?1$/.test(t)) {
    t = t.replace(/\^-?1$/, '');
    inv = true;
  } else if (/-1$/.test(t)) {
    t = t.slice(0, -2);
    inv = true;
  } else if (/inv$/.test(t)) {
    t = t.slice(0, -3);
    inv = true;
  }

  // 去掉 sigma 前缀（sigma / s）与下划线；要求前缀后确实剩下数字
  const stripped = t.replace(/^sigma/, '').replace(/^s/, '').replace(/_/g, '');

  if (!/^\d+$/.test(stripped)) return { error: true };
  const i = Number(stripped);
  if (!Number.isInteger(i) || i < 1) return { error: true };
  return { i, inv };
}

export interface ParsedWord {
  word: Word;
  issue: StepIssue | null;
  /** 出错的 token 序号（从左到右，从 0 起）。 */
  at: number;
}

/**
 * 解析一个编带词；股数 n 决定合法下标范围 1..n-1。
 * 从左到右扫描，返回首个问题：
 *   先遇到无法识别的符号 -> parse-token
 *   再检查长度上限 maxLen
 *   再检查首个下标越界 -> index-out-of-range
 */
export function parseWord(text: string, n: number, maxLen = 24): ParsedWord {
  const normalized = normalizeInput(text);
  const tokens = normalized
    .split(/[\s,，、;；]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const word: Word = [];
  for (let k = 0; k < tokens.length; k++) {
    const g = parseToken(tokens[k]);
    if ('error' in g) {
      return {
        word,
        at: k,
        issue: {
          code: 'parse-token',
          index: k,
          message: `第 ${k + 1} 个符号 “${tokens[k]}” 无法识别（应形如 σ1 或 σ1^-1）`
        }
      };
    }
    word.push(g);
  }

  if (word.length > maxLen) {
    return {
      word,
      at: maxLen,
      issue: {
        code: 'word-too-long',
        index: maxLen,
        message: `词长 ${word.length} 超过上限 ${maxLen} 个生成元`
      }
    };
  }

  for (let k = 0; k < word.length; k++) {
    if (word[k].i < 1 || word[k].i > n - 1) {
      return {
        word,
        at: k,
        issue: {
          code: 'index-out-of-range',
          index: k,
          message: `第 ${k + 1} 个生成元 σ${word[k].i} 越界：${n} 股只允许 σ1…σ${n - 1}（首个越界位置：词内索引 ${k}）`
        }
      };
    }
  }

  return { word, issue: null, at: -1 };
}

// —— 自由群 ------------------------------------------------------------------

/** 反复约消相邻逆元：…k(-k)… -> ……。返回新数组。 */
export function reduceFree(letters: FreeWord): FreeWord {
  const stack: FreeWord = [];
  for (const l of letters) {
    if (stack.length > 0 && stack[stack.length - 1] === -l) {
      stack.pop();
    } else {
      stack.push(l);
    }
  }
  return stack;
}

/** 两个自由群元素相乘（连接后约消）。 */
export function mulFree(a: FreeWord, b: FreeWord): FreeWord {
  return reduceFree([...a, ...b]);
}

export function invFree(a: FreeWord): FreeWord {
  return [...a].reverse().map((l) => -l);
}

export function isFreeEqual(a: FreeWord, b: FreeWord): boolean {
  if (a.length !== b.length) return false;
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return false;
  return true;
}

// —— 显示 --------------------------------------------------------------------

export function formatGenerator(g: Generator): string {
  const sub = String(g.i)
    .split('')
    .map((d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])
    .join('');
  return `σ${sub}${g.inv ? '⁻¹' : ''}`;
}

export function formatWord(word: Word): string {
  return word.length === 0 ? '（空词，平凡编带）' : word.map(formatGenerator).join(' ');
}

export function formatLetter(l: number): string {
  const base = `x${String(Math.abs(l))
    .split('')
    .map((d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])
    .join('')}`;
  return l > 0 ? base : `${base}⁻¹`;
}

export function formatFreeWord(w: FreeWord): string {
  return w.length === 0
    ? '1'
    : w
        .map((l) => formatLetter(l))
        // 视觉上略去纯拼接的乘号，逆元带上标
        .join('');
}

export function formatTuple(t: Tuple): string {
  return '(' + t.map(formatFreeWord).join(', ') + ')';
}
