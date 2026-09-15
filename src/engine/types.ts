// 引擎核心类型 —— 一切结论都由这些结构推导，界面只是把它们画出来。

/** 一个 Artin 生成元 σ_i 的有向出现；inv 为 true 表示 σ_i^{-1}。i 从 1 起。 */
export interface Generator {
  i: number;
  inv: boolean;
}

/** 编带词（生成元序列，按从左到右的作用顺序书写）。 */
export type Word = Generator[];

/** 公理类型：逆元相消 / 逆元插入 / 远交换 / 辫关系。 */
export type AxiomKind = 'cancel' | 'insert' | 'commute' | 'braid';

/**
 * 一步论证的规则。
 * cancel: 删除片段 [start,end)，要求该片段恰为相邻逆元 (i,+)(i,-) 或 (i,-)(i,+)
 * insert: 在位置 start 插入参数为 i 的相邻逆元对（end 不使用）
 * commute: 对片段中的两个生成元做 |i-j|>=2 的交换（方向无关）
 * braid: 对片段做 σi σi+1 σi ↔ σi+1 σi σi+1（方向无关，仅正生成元）
 */
export interface RuleSpec {
  kind: AxiomKind;
  i: number | null;
  j: number | null;
}

/** 论证路线中的一步（界面草稿态；空字段保留为字符串以便编辑）。 */
export interface ProofStepDraft {
  id: string;
  parent: string; // 前一步 id；根路线用 '' 表示起始词
  wordText: string; // 本步声称得到的词
  start: string; // 连续片段 [start,end) 的左端点（按当前词的生成元索引，从 0 起）
  end: string;
  rule: RuleSpec;
}

export interface RouteDraft {
  name: string;
  rootText: string;
  steps: ProofStepDraft[];
}

/** 解析 / 核查中发现的问题；index 为“从左到右第一个”越界/出错位置。 */
export type IssueCode =
  | 'parse-token'
  | 'index-out-of-range'
  | 'word-too-long'
  | 'broken-parent'
  | 'segment-out-of-range'
  | 'wrong-axiom'
  | 'word-mismatch'
  | 'rule-param';

export interface StepIssue {
  code: IssueCode;
  /** 首个问题位置：生成元索引、片段端点或词内位置（视 code 而定）。 */
  index: number;
  message: string;
}

export type StepStatus = 'ok' | 'error' | 'skipped';

export interface StepResult {
  id: string;
  status: StepStatus;
  /** 本步改写后实际得到的词（仅在合法时有意义）。 */
  derivedWord: Word;
  issue: StepIssue | null;
}

export interface RouteValidation {
  rootWord: Word;
  rootIssue: StepIssue | null;
  results: StepResult[];
  /** 路线整体合法：起始词合法且每一步都成立。 */
  legal: boolean;
  finalWord: Word;
}

/** 自由群元素：已约消的字母序列；字母 ±k 表示 x_k 或 x_k^{-1}。 */
export type FreeWord = number[];

/** 自由群元组 (x_1, …, x_n)，每个分量都是已约消的自由群词。 */
export type Tuple = FreeWord[];

/** 两条合法（或待判）路线比较的完整结果。 */
export interface Comparison {
  legal: boolean;
  /** 各自首个无法核查处的人类可读说明（步序信息写在 message 中）。 */
  firstStops: [number, string][];
  wordA: Word;
  wordB: Word;
  permA: number[];
  permB: number[];
  samePermutation: boolean;
  tupleA: Tuple;
  tupleB: Tuple;
  equivalent: boolean;
  /** 自由群元组首个不同分量（1-based）；全等为 -1。 */
  firstDiffComponent: number;
}
