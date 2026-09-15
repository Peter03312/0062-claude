import type { AxiomKind, ProofStepDraft, RouteDraft, StepResult, Word } from '../engine/types';
import { AXIOM_LABELS } from '../engine/examples';
import { formatWord, parseWord } from '../engine/words';
import { BraidSvg } from './BraidSvg';

interface StepEditorProps {
  route: RouteDraft;
  index: number;
  step: ProofStepDraft;
  parentWord: Word;
  result: StepResult | undefined;
  n: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<ProofStepDraft>) => void;
  onRuleChange: (kind: AxiomKind) => void;
  onRemove: () => void;
}

const KIND_ORDER: AxiomKind[] = ['cancel', 'insert', 'commute', 'braid'];

export function StepEditor({
  route,
  index,
  step,
  parentWord,
  result,
  n,
  selected,
  onSelect,
  onChange,
  onRuleChange,
  onRemove
}: StepEditorProps) {
  const start = Number(step.start);
  const end = Number(step.end);
  const validRange =
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    start <= parentWord.length &&
    end >= start &&
    end <= parentWord.length;
  const isInsert = step.rule.kind === 'insert';
  const claimedPreview = parseWord(step.wordText, n);

  return (
    <div
      className={`step ${result?.status === 'error' ? 'step-error' : ''} ${
        result?.status === 'ok' ? 'step-ok' : ''
      } ${selected ? 'step-selected' : ''}`}
      data-testid={`step-${route.name === '路线 A' ? 'a' : 'b'}-${index}`}
      onClick={onSelect}
    >
      <div className="step-head">
        <span className="step-no">第 {index + 1} 步</span>
        <span className={`step-badge step-badge-${result?.status ?? 'idle'}`}>
          {result?.status === 'ok' ? '✔ 成立' : result?.status === 'error' ? '✘ 不成立' : result?.status === 'skipped' ? '— 跳过' : '待核查'}
        </span>
        <button
          type="button"
          className="btn-mini btn-danger"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          删除
        </button>
      </div>

      <div className="step-grid">
        <label className="field">
          <span>前一步</span>
          <select
            value={step.parent}
            onChange={(e) => onChange({ parent: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            data-testid="parent-select"
          >
            <option value="">起始词（根）</option>
            {route.steps
              .filter((_s, k) => k < index)
              .map((s, k) => (
                <option key={s.id} value={s.id}>
                  第 {k + 1} 步
                </option>
              ))}
          </select>
        </label>

        <label className="field">
          <span>公理</span>
          <select
            value={step.rule.kind}
            onChange={(e) => onRuleChange(e.target.value as AxiomKind)}
            onClick={(e) => e.stopPropagation()}
            data-testid="axiom-select"
          >
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {AXIOM_LABELS[k]}
              </option>
            ))}
          </select>
        </label>

        <label className="field field-narrow">
          <span>片段起</span>
          <input
            value={step.start}
            onChange={(e) => onChange({ start: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            inputMode="numeric"
            data-testid="seg-start"
          />
        </label>
        <label className="field field-narrow">
          <span>片段止</span>
          <input
            value={step.end}
            onChange={(e) => onChange({ end: e.target.value })}
            onClick={(ev) => ev.stopPropagation()}
            inputMode="numeric"
            disabled={isInsert}
            data-testid="seg-end"
          />
        </label>

        {isInsert && (
          <label className="field field-narrow">
            <span>i</span>
            <input
              value={step.rule.i ?? ''}
              onChange={(e) => onChange({ rule: { ...step.rule, i: e.target.value === '' ? null : Number(e.target.value) } })}
              onClick={(e) => e.stopPropagation()}
              inputMode="numeric"
              data-testid="insert-i"
            />
          </label>
        )}
      </div>

      <label className="field field-full">
        <span>本步得到的词（按公理应得的结果）</span>
        <input
          className="word-input"
          value={step.wordText}
          onChange={(e) => onChange({ wordText: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="如 σ2 σ1 σ2"
          data-testid="step-word"
        />
      </label>

      {result?.status === 'error' && result.issue && (
        <p className="error-text" data-testid="step-error" onClick={(e) => e.stopPropagation()}>
          {result.issue.message}
        </p>
      )}

      {selected && (
        <div className="step-detail" onClick={(e) => e.stopPropagation()}>
          <div className="parent-word">
            <strong>父词：</strong>
            <span className="mono">{formatWord(parentWord)}</span>
          </div>
          {validRange ? (
            <BraidSvg
              word={parentWord}
              n={n}
              selStart={start}
              selEnd={isInsert ? start : end}
              showInsert={isInsert}
              testId={`step-svg-${route.name === '路线 A' ? 'a' : 'b'}-${index}`}
            />
          ) : (
            <p className="warn-text">片段端点 [{step.start},{step.end}) 不在父词范围 0…{parentWord.length} 内，无法标出选中片段。</p>
          )}
          {claimedPreview.issue ? (
            <p className="warn-text">所得词预览：{claimedPreview.issue.message}</p>
          ) : (
            <p className="muted-text">所得词预览：{formatWord(claimedPreview.word)}</p>
          )}
          {result?.status === 'ok' && (
            <p className="ok-text">局部改写复现一致：{formatWord(result.derivedWord)}</p>
          )}
        </div>
      )}
    </div>
  );
}
