import type { AxiomKind, RouteDraft, RouteValidation, Word } from '../engine/types';
import { formatWord, parseWord } from '../engine/words';
import { BraidSvg } from './BraidSvg';
import { StepEditor } from './StepEditor';

interface RoutePanelProps {
  side: 'A' | 'B';
  n: number;
  route: RouteDraft;
  validation: RouteValidation;
  selectedStep: string | null;
  onSelectStep: (id: string | null) => void;
  onRouteChange: (patch: Partial<RouteDraft>) => void;
  onStepChange: (id: string, patch: Record<string, unknown>) => void;
  onStepRule: (id: string, kind: AxiomKind) => void;
  onAddStep: () => void;
  onRemoveStep: (id: string) => void;
}

export function RoutePanel({
  side,
  n,
  route,
  validation,
  selectedStep,
  onSelectStep,
  onRouteChange,
  onStepChange,
  onStepRule,
  onAddStep,
  onRemoveStep
}: RoutePanelProps) {
  const rootParsed = parseWord(route.rootText, n);

  // 每一步的“父词”：第 0 步是起始词，其余是上一步复现出的词（或当前词）。
  const parentWords: Word[] = [];
  let acc: Word = validation.rootWord;
  route.steps.forEach((_s, k) => {
    parentWords.push(k === 0 ? validation.rootWord : acc);
    const r = validation.results[k];
    if (r && r.status === 'ok') acc = r.derivedWord;
  });

  return (
    <section className={`route-panel route-${side}`} data-testid={`route-${side}`}>
      <div className="route-head">
        <h2>{route.name}</h2>
        <input
          className="name-input"
          value={route.name}
          onChange={(e) => onRouteChange({ name: e.target.value })}
          aria-label="路线名称"
        />
      </div>

      <label className="field field-full">
        <span>起始词（至多 24 个 σi / σi⁻¹，可用空格或逗号分隔）</span>
        <input
          className="word-input root-input"
          value={route.rootText}
          onChange={(e) => onRouteChange({ rootText: e.target.value })}
          placeholder="例如 σ1 σ2 σ1"
          data-testid={`root-${side}`}
        />
      </label>

      {validation.rootIssue ? (
        <p className="error-text" data-testid={`root-error-${side}`}>
          {validation.rootIssue.message}
        </p>
      ) : (
        <div className="svg-wrap" data-testid={`root-svg-${side}`}>
          <BraidSvg word={rootParsed.issue ? [] : rootParsed.word} n={n} />
          <p className="muted-text">起始词：{formatWord(validation.rootWord)}</p>
        </div>
      )}

      <div className="steps-list">
        {route.steps.map((s, k) => (
          <StepEditor
            key={s.id}
            route={route}
            index={k}
            step={s}
            parentWord={parentWords[k]}
            result={validation.results[k]}
            n={n}
            selected={selectedStep === s.id}
            onSelect={() => onSelectStep(selectedStep === s.id ? null : s.id)}
            onChange={(patch) => onStepChange(s.id, patch)}
            onRuleChange={(kind) => onStepRule(s.id, kind)}
            onRemove={() => onRemoveStep(s.id)}
          />
        ))}
      </div>

      <button type="button" className="btn btn-add" onClick={onAddStep} data-testid={`add-step-${side}`}>
        ＋ 添加论证步骤
      </button>
      <p className="hint-text">
        新增步骤默认挂在最后；请用“前一步”下拉保证线性链。第 1 步的前一步必须是起始词。
      </p>
    </section>
  );
}
