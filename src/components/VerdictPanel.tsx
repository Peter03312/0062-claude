import type { Comparison, RouteValidation } from '../engine/types';
import { formatFreeWord, formatWord } from '../engine/words';

interface VerdictPanelProps {
  side: 'live' | 'sealed';
  n: number;
  va: RouteValidation;
  vb: RouteValidation;
  cmp: Comparison;
  sealedHash?: string;
  currentHash?: string;
  sealedAt?: string;
  onSeal?: () => void;
  report?: string;
}

function RouteLegality({ v, label }: { v: RouteValidation; label: string }) {
  if (v.legal) {
    return (
      <p className="ok-text">
        {label}：每一步都可由所声明公理复现，路线合法，终词 {formatWord(v.finalWord)}。
      </p>
    );
  }
  if (v.rootIssue) {
    return (
      <p className="error-text">
        {label}：起始词无法核查——{v.rootIssue.message}
      </p>
    );
  }
  const bad = v.results.find((r) => r.status === 'error');
  const k = v.results.findIndex((r) => r.status === 'error');
  if (bad?.issue) {
    return (
      <p className="error-text">
        {label}：首个无法核查处在第 {k + 1} 步——{bad.issue.message}
      </p>
    );
  }
  return <p className="error-text">{label}：路线不完整，无法核查。</p>;
}

export function VerdictPanel({
  side,
  n,
  va,
  vb,
  cmp,
  sealedHash,
  currentHash,
  sealedAt,
  onSeal,
  report
}: VerdictPanelProps) {
  const stale = side === 'sealed' && sealedHash !== undefined && currentHash !== sealedHash;

  return (
    <div className={`verdict verdict-${side}`} data-testid={`verdict-${side}`}>
      {side === 'sealed' && (
        <div className="seal-row">
          <h2>展签结论（已封存）</h2>
          {sealedAt && <span className="muted-text">封存时间 {new Date(sealedAt).toLocaleString('zh-CN')}</span>}
        </div>
      )}
      {side === 'live' && <h2>核查结论</h2>}

      {stale && (
        <p className="error-text" data-testid="verdict-stale">
          ⚠ 编辑后输入已变化，旧结论作废。请重新点击“封存并生成展签”。
        </p>
      )}

      <RouteLegality v={va} label="路线 A" />
      <RouteLegality v={vb} label="路线 B" />

      {!cmp.legal && (
        <p className="warn-text" data-testid="verdict-illegal">
          至少一条路线尚不合法，不能进行等价判定；请先修正上面首个出错位置。
        </p>
      )}

      {cmp.legal && (
        <>
          <div className="perm-row" data-testid="perm-row">
            <span>
              末端排列 A：（{cmp.permA.join(', ')}）　末端排列 B：（{cmp.permB.join(', ')}）
            </span>
            <span className={cmp.samePermutation ? 'ok-text inline' : 'warn-text inline'}>
              {cmp.samePermutation ? '末端排列相同' : '末端排列不同'}
            </span>
          </div>

          {cmp.equivalent ? (
            <p className="big-verdict ok" data-testid="verdict-equal">
              ✔ 自由群元组逐分量相等：两条编带过程在 B_{n} 中代表同一元素——过程等价。
            </p>
          ) : (
            <>
              <p className="big-verdict bad" data-testid="verdict-notequal">
                ✘ 两条路线都合法，但自由群元组不同——过程不等价。
                {cmp.samePermutation && '注意：它们仅有相同的末端排列，排列相同不足以判等。'}
              </p>
              <p className="error-text" data-testid="first-diff">
                首个不同分量：第 {cmp.firstDiffComponent} 个分量（x{String(cmp.firstDiffComponent)
                  .split('')
                  .map((d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])
                  .join('')}）
                ：A = {formatFreeWord(cmp.tupleA[cmp.firstDiffComponent - 1])}，B ={' '}
                {formatFreeWord(cmp.tupleB[cmp.firstDiffComponent - 1])}
                {cmp.samePermutation && '（两者末端排列相同，但排列相同不足以判等）'}
              </p>
            </>
          )}

          <details className="tuple-details">
            <summary>查看完整自由群元组（Artin 表示，{n} 股）</summary>
            <div className="tuple-grid">
              <div>
                <strong>A：</strong>
                <ol>
                  {cmp.tupleA.map((w, k) => (
                    <li key={k} className={!cmp.equivalent && k + 1 === cmp.firstDiffComponent ? 'diff-comp' : ''}>
                      x{String(k + 1)
                        .split('')
                        .map((d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])
                        .join('')}
                      ↦ {formatFreeWord(w)}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <strong>B：</strong>
                <ol>
                  {cmp.tupleB.map((w, k) => (
                    <li key={k} className={!cmp.equivalent && k + 1 === cmp.firstDiffComponent ? 'diff-comp' : ''}>
                      x{String(k + 1)
                        .split('')
                        .map((d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])
                        .join('')}
                      ↦ {formatFreeWord(w)}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </details>
        </>
      )}

      {side === 'live' && (
        <button
          type="button"
          className="btn btn-seal"
          disabled={!cmp.legal}
          onClick={onSeal}
          data-testid="seal-btn"
          title={cmp.legal ? '把当前输入与结论封存档，并生成可打印展签' : '两条路线均合法后才能封存'}
        >
          封存并生成展签
        </button>
      )}

      {side === 'sealed' && report && !stale && (
        <pre className="label-card" data-testid="label-card">
          {report}
        </pre>
      )}
    </div>
  );
}
