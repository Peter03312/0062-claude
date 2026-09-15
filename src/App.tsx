import { useEffect, useMemo, useState } from 'react';
import type { AxiomKind } from './engine/types';
import type { BookState, Snapshot, Verdict } from './state/storage';
import {
  clearVerdict,
  deleteSnapshot,
  loadDraft,
  loadSnapshots,
  loadVerdict,
  saveDraft,
  saveSnapshot,
  sealVerdict,
  stateHash
} from './state/storage';
import { buildExamples, contentHash, makeStep } from './engine/examples';
import { compareRoutes, validateRoute } from './engine/validate';
import { formatFreeWord, formatWord } from './engine/words';
import { RoutePanel } from './components/RoutePanel';
import { VerdictPanel } from './components/VerdictPanel';

const EXAMPLES = buildExamples();

function freshState(): BookState {
  const ex = EXAMPLES[1]; // 默认打开反例，强调“排列相同≠等价”
  return {
    n: ex.n,
    routeA: structuredClone(ex.routeA),
    routeB: structuredClone(ex.routeB)
  };
}

function buildReport(state: BookState, cmp: ReturnType<typeof compareRoutes>): string {
  const lines: string[] = [];
  lines.push('编带等价论证 · 展签');
  lines.push(`封存时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push(`内容指纹：${stateHash(state)}`);
  lines.push(`股数：${state.n}`);
  lines.push('');
  lines.push(`路线 A（${state.routeA.name}） 起始词：${state.routeA.rootText.trim() || '（空词）'}`);
  state.routeA.steps.forEach((s, k) => {
    lines.push(
      `  第${k + 1}步 前序:${s.parent || '起始词'} 片段:[${s.start},${s.end}) 公理:${s.rule.kind}${
        s.rule.i !== null ? `(i=${s.rule.i})` : ''
      } → ${s.wordText}`
    );
  });
  lines.push(`  终词：${formatWord(cmp.wordA)}`);
  lines.push(`路线 B（${state.routeB.name}） 起始词：${state.routeB.rootText.trim() || '（空词）'}`);
  state.routeB.steps.forEach((s, k) => {
    lines.push(
      `  第${k + 1}步 前序:${s.parent || '起始词'} 片段:[${s.start},${s.end}) 公理:${s.rule.kind}${
        s.rule.i !== null ? `(i=${s.rule.i})` : ''
      } → ${s.wordText}`
    );
  });
  lines.push(`  终词：${formatWord(cmp.wordB)}`);
  lines.push('');
  lines.push(`末端排列 A：(${cmp.permA.join(', ')})`);
  lines.push(`末端排列 B：(${cmp.permB.join(', ')})`);
  lines.push(`Artin 自由群元组 A：(${cmp.tupleA.map(formatFreeWord).join(', ')})`);
  lines.push(`Artin 自由群元组 B：(${cmp.tupleB.map(formatFreeWord).join(', ')})`);
  lines.push('');
  if (cmp.equivalent) {
    lines.push('结论：两条路线每一步均可由逆元相消/插入、远交换或辫关系复现，');
    lines.push('且自由群元组逐分量相等，故两个编带过程等价（Artin 表示忠实，同一自由群自同构）。');
  } else {
    lines.push(`结论：两路线均合法，但自由群元组第 ${cmp.firstDiffComponent} 分量首先不同，`);
    lines.push(
      `A=${formatFreeWord(cmp.tupleA[cmp.firstDiffComponent - 1])}，B=${formatFreeWord(
        cmp.tupleB[cmp.firstDiffComponent - 1]
      )}，故过程不等价` +
        (cmp.samePermutation ? '（尽管末端排列相同，排列相同不能判等）。' : '。')
    );
  }
  return lines.join('\n');
}

export default function App() {
  const [state, setState] = useState<BookState>(() => loadDraft() ?? freshState());
  const [selected, setSelected] = useState<{ a: string | null; b: string | null }>({ a: null, b: null });
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => loadSnapshots());
  const [verdict, setVerdict] = useState<Verdict | null>(() => loadVerdict());
  const [snapName, setSnapName] = useState('');
  // 记录“刚刚被编辑作废”的封存结论，用于在页面上持续提示直到重新封存。
  const [staledVerdict, setStaledVerdict] = useState<Verdict | null>(null);

  const hash = useMemo(() => stateHash(state), [state]);

  // 编辑后自动保存草稿，并使旧结论失效（仅当指纹真的变化）。
  useEffect(() => {
    saveDraft(state);
    setVerdict((current) => {
      if (current && current.hash !== hash) {
        clearVerdict();
        setStaledVerdict(current);
        return null;
      }
      return current;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const va = useMemo(() => validateRoute(state.routeA, state.n), [state.routeA, state.n]);
  const vb = useMemo(() => validateRoute(state.routeB, state.n), [state.routeB, state.n]);
  const cmp = useMemo(
    () => compareRoutes(va, vb, state.n, state.routeA.steps, state.routeB.steps),
    [va, vb, state.n, state.routeA.steps, state.routeB.steps]
  );

  const patchRoute = (side: 'a' | 'b', patch: Partial<BookState['routeA']>) =>
    setState((s) => ({ ...s, [side === 'a' ? 'routeA' : 'routeB']: { ...(side === 'a' ? s.routeA : s.routeB), ...patch } }));

  const patchStep = (side: 'a' | 'b', id: string, patch: Record<string, unknown>) =>
    setState((s) => {
      const route = side === 'a' ? s.routeA : s.routeB;
      return {
        ...s,
        [side === 'a' ? 'routeA' : 'routeB']: {
          ...route,
          steps: route.steps.map((st) => (st.id === id ? ({ ...st, ...patch } as typeof st) : st))
        }
      };
    });

  const setStepRule = (side: 'a' | 'b', id: string, kind: AxiomKind) =>
    setState((s) => {
      const route = side === 'a' ? s.routeA : s.routeB;
      return {
        ...s,
        [side === 'a' ? 'routeA' : 'routeB']: {
          ...route,
          steps: route.steps.map((st) =>
            st.id === id
              ? {
                  ...st,
                  rule: { kind, i: kind === 'insert' ? st.rule.i ?? 1 : null, j: null },
                  ...(kind === 'insert' ? { end: st.start } : {})
                }
              : st
          )
        }
      };
    });

  const addStep = (side: 'a' | 'b') =>
    setState((s) => {
      const route = side === 'a' ? s.routeA : s.routeB;
      const parent = route.steps.length === 0 ? '' : route.steps[route.steps.length - 1].id;
      const st = makeStep(parent);
      return { ...s, [side === 'a' ? 'routeA' : 'routeB']: { ...route, steps: [...route.steps, st] } };
    });

  const removeStep = (side: 'a' | 'b', id: string) =>
    setState((s) => {
      const route = side === 'a' ? s.routeA : s.routeB;
      return {
        ...s,
        [side === 'a' ? 'routeA' : 'routeB']: { ...route, steps: route.steps.filter((st) => st.id !== id) }
      };
    });

  const loadExample = (key: string) => {
    const ex = EXAMPLES.find((e) => e.key === key);
    if (!ex) return;
    setState({
      n: ex.n,
      routeA: structuredClone(ex.routeA),
      routeB: structuredClone(ex.routeB)
    });
    setSelected({ a: null, b: null });
  };

  const onSeal = () => {
    const report = buildReport(state, cmp);
    const v: Verdict = {
      hash,
      sealedAt: new Date().toISOString(),
      report,
      equivalent: cmp.equivalent,
      legal: true
    };
    sealVerdict(v);
    setVerdict(v);
    setStaledVerdict(null);
  };

  const onSaveSnapshot = () => {
    setSnapshots(saveSnapshot(snapName, state));
    setSnapName('');
  };

  const onRestore = (snap: Snapshot) => {
    setState(structuredClone(snap.state));
    setSelected({ a: null, b: null });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>编带等价论证册</h1>
        <p className="subtitle">
          Artin 编带群 · 自由群表示逐步核查——每一步局部改写都可复现，绝不仅凭末端排列判等
        </p>
      </header>

      <div className="toolbar" data-testid="toolbar">
        <label className="n-picker">
          股数 n（3～7）：
          <select
            value={state.n}
            onChange={(e) => setState((s) => ({ ...s, n: Number(e.target.value) }))}
            data-testid="n-picker"
          >
            {[3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="example-picker">
          载入示例：
          <select value="" onChange={(e) => loadExample(e.target.value)} data-testid="example-picker">
            <option value="">— 选择 —</option>
            {EXAMPLES.map((e) => (
              <option key={e.key} value={e.key}>
                {e.title}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (confirm('清空当前两条路线？草稿会被空白稿覆盖。')) {
              const empty = freshState();
              empty.routeA = { name: '路线 A', rootText: '', steps: [] };
              empty.routeB = { name: '路线 B', rootText: '', steps: [] };
              setState(empty);
            }
          }}
        >
          清空
        </button>

        <span className="hash-tag" data-testid="hash-tag">
          内容指纹 {hash}
        </span>
      </div>

      <main className="routes-grid">
        <RoutePanel
          side="A"
          n={state.n}
          route={state.routeA}
          validation={va}
          selectedStep={selected.a}
          onSelectStep={(id) => setSelected((s) => ({ ...s, a: id }))}
          onRouteChange={(patch) => patchRoute('a', patch)}
          onStepChange={(id, patch) => patchStep('a', id, patch)}
          onStepRule={(id, kind) => setStepRule('a', id, kind)}
          onAddStep={() => addStep('a')}
          onRemoveStep={(id) => removeStep('a', id)}
        />
        <RoutePanel
          side="B"
          n={state.n}
          route={state.routeB}
          validation={vb}
          selectedStep={selected.b}
          onSelectStep={(id) => setSelected((s) => ({ ...s, b: id }))}
          onRouteChange={(patch) => patchRoute('b', patch)}
          onStepChange={(id, patch) => patchStep('b', id, patch)}
          onStepRule={(id, kind) => setStepRule('b', id, kind)}
          onAddStep={() => addStep('b')}
          onRemoveStep={(id) => removeStep('b', id)}
        />
      </main>

      <VerdictPanel side="live" n={state.n} va={va} vb={vb} cmp={cmp} onSeal={onSeal} />

      {!verdict && staledVerdict && (
        <div className="verdict verdict-sealed" data-testid="verdict-stale-banner">
          <p className="error-text" data-testid="verdict-stale">
            ⚠ 封存于 {new Date(staledVerdict.sealedAt).toLocaleString('zh-CN')} 的旧展签结论
            （指纹 {staledVerdict.hash.slice(0, 8)}）已因编辑作废。请核查当前输入后重新封存。
          </p>
        </div>
      )}

      {verdict && verdict.hash === hash && (
        <VerdictPanel
          side="sealed"
          n={state.n}
          va={va}
          vb={vb}
          cmp={cmp}
          sealedHash={verdict.hash}
          currentHash={hash}
          sealedAt={verdict.sealedAt}
          report={verdict.report}
        />
      )}

      <section className="snapshots" data-testid="snapshots">
        <h2>草稿备份与恢复</h2>
        <p className="muted-text">
          编辑内容自动保存为草稿（localStorage，离线）。旧结论在任何编辑后自动作废；也可把当前稿命名备份后随时恢复。
        </p>
        <div className="snap-controls">
          <input
            value={snapName}
            onChange={(e) => setSnapName(e.target.value)}
            placeholder="备份名称（可选）"
            data-testid="snap-name"
          />
          <button type="button" className="btn" onClick={onSaveSnapshot} data-testid="snap-save">
            存为备份
          </button>
        </div>
        {snapshots.length === 0 ? (
          <p className="muted-text">暂无命名备份。</p>
        ) : (
          <ul className="snap-list">
            {snapshots.map((s) => (
              <li key={s.id}>
                <span className="snap-name">{s.name}</span>
                <span className="muted-text">{new Date(s.savedAt).toLocaleString('zh-CN')}</span>
                <button type="button" className="btn-mini" onClick={() => onRestore(s)} data-testid={`snap-restore-${s.id}`}>
                  恢复
                </button>
                <button type="button" className="btn-mini btn-danger" onClick={() => setSnapshots(deleteSnapshot(s.id))}>
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="muted-text tiny">（指纹算法 FNV-1a：{contentHash('self-check')} 为自检常量，仅用于失效比对。）</p>
      </section>

      <footer className="app-footer">
        <p>
          索引约定：股按 1…n 编号；σ_i 交换第 i、i+1 股。词从左到右作用；片段用半开区间 [起,止) 的生成元下标（从 0
          起），插入时起=止表示插入位置。
        </p>
      </footer>
    </div>
  );
}
