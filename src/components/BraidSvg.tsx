import { useMemo } from 'react';
import type { Word } from '../engine/types';
import { formatGenerator } from '../engine/words';

// 纯几何编带图（无任何外部图片）。
// 约定：σ_i 为“左上跨”——列前位于槽 i 的股压过槽 i+1 的股；
//       σ_i⁻¹ 为右上跨——列前位于槽 i+1 的股压过槽 i 的股。
// 下穿股画成虚线并在交叉处留出白色缺口。

interface BraidSvgProps {
  word: Word;
  n: number;
  selStart?: number;
  selEnd?: number;
  showInsert?: boolean;
  testId?: string;
}

const COL_W = 48;
const TOP = 26;
const CROSS_H = 66;
const BOT_PAD = 28;
const COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#be185d'];
const strandColor = (label: number) => COLORS[(label - 1) % COLORS.length];

interface Col {
  col: number;
  i: number;
  inv: boolean;
  before: number[]; // 列前各槽位的股编号
}

export function BraidSvg({ word, n, selStart, selEnd, showInsert = false, testId }: BraidSvgProps) {
  const width = Math.max(n * COL_W + 30, word.length * COL_W + 92);
  const h = TOP + (word.length === 0 ? 1 : word.length) * CROSS_H + BOT_PAD;
  const x = (slot: number) => 14 + slot * COL_W + COL_W / 2;
  const yC = (col: number) => TOP + col * CROSS_H + CROSS_H / 2;

  const cols = useMemo<Col[]>(() => {
    const labels = Array.from({ length: n }, (_, k) => k + 1);
    return word.map((g, col) => {
      const before = labels.slice();
      const a = g.i - 1;
      [labels[a], labels[a + 1]] = [labels[a + 1], labels[a]];
      return { col, i: g.i, inv: g.inv, before };
    });
  }, [word, n]);

  const finalLabels = useMemo(() => {
    const labels = Array.from({ length: n }, (_, k) => k + 1);
    word.forEach((g) => {
      const a = g.i - 1;
      [labels[a], labels[a + 1]] = [labels[a + 1], labels[a]];
    });
    return labels;
  }, [word, n]);

  const hasSel = (selStart ?? -2) >= 0 && (selEnd ?? -1) > (selStart ?? 0);
  const off = CROSS_H * 0.4;

  return (
    <svg
      data-testid={testId}
      className="braid-svg"
      width={width}
      height={h}
      viewBox={`0 0 ${width} ${h}`}
      role="img"
      aria-label={`编带图，${word.length} 个交叉`}
    >
      {/* 顶部端点 */}
      {Array.from({ length: n }, (_, slot) => (
        <g key={`top-${slot}`}>
          <text x={x(slot)} y={14} textAnchor="middle" className="svg-label">
            {slot + 1}
          </text>
          <circle cx={x(slot)} cy={TOP} r={3.5} fill={strandColor(slot + 1)} />
        </g>
      ))}

      {/* 空词：n 条垂直彩线 */}
      {word.length === 0 &&
        Array.from({ length: n }, (_, slot) => (
          <line
            key={`empty-${slot}`}
            x1={x(slot)}
            y1={TOP}
            x2={x(slot)}
            y2={h - BOT_PAD + 4}
            stroke={strandColor(slot + 1)}
            strokeWidth={3.2}
          />
        ))}

      {cols.map((c) => {
        const inSel = hasSel && c.col >= (selStart as number) && c.col < (selEnd as number);
        const y0 = yC(c.col) - CROSS_H / 2;
        const y1 = yC(c.col) + CROSS_H / 2;
        const a = c.i - 1;
        const b = c.i;
        // 列前槽 a、b 的股编号；σ 正：a 股上跨；σ 逆：b 股上跨
        const overLabel = c.inv ? c.before[b] : c.before[a];
        const underLabel = c.inv ? c.before[a] : c.before[b];
        const overFrom = c.inv ? b : a;
        const overTo = c.inv ? a : b;
        const underFrom = c.inv ? a : b;
        const underTo = c.inv ? b : a;
        const overD = `M ${x(overFrom)} ${y0} C ${x(overFrom)} ${y0 + off}, ${x(overTo)} ${
          y1 - off
        }, ${x(overTo)} ${y1}`;

        return (
          <g key={`col-${c.col}`}>
            {inSel && (
              <rect
                x={8}
                y={y0 + 3}
                width={n * COL_W + 12}
                height={CROSS_H - 6}
                rx={8}
                fill="#fde68a"
                opacity={0.6}
              />
            )}

            {/* 不参与交叉的股：垂直线 */}
            {Array.from({ length: n }, (_, slot) =>
              slot === a || slot === b ? null : (
                <line
                  key={`v-${c.col}-${slot}`}
                  x1={x(slot)}
                  y1={y0}
                  x2={x(slot)}
                  y2={y1}
                  stroke={strandColor(c.before[slot])}
                  strokeWidth={3.2}
                />
              )
            )}

            {/* 下穿股：虚线对角（在交叉处天然被上跨股的白边遮挡） */}
            <line
              x1={x(underFrom)}
              y1={y0}
              x2={x(underTo)}
              y2={y1}
              stroke={strandColor(underLabel)}
              strokeWidth={2.6}
              strokeDasharray="5 4"
              opacity={0.75}
            />

            {/* 上跨股：白色描边 + 彩色贝塞尔，形成压跨缺口 */}
            <path d={overD} stroke="#ffffff" strokeWidth={8.5} fill="none" />
            <path
              d={overD}
              stroke={strandColor(overLabel)}
              strokeWidth={inSel ? 4.8 : 3.6}
              fill="none"
              className={inSel ? 'strand-selected' : undefined}
            />

            {/* 右侧生成元标注 */}
            <text
              x={n * COL_W + 30}
              y={yC(c.col) + 4}
              className="svg-tag"
              fill={inSel ? '#b45309' : '#374151'}
            >
              {formatGenerator({ i: c.i, inv: c.inv })}
            </text>
          </g>
        );
      })}

      {/* 插入位置标记（空片段 start == end） */}
      {showInsert && (selStart ?? -1) >= 0 && (selStart as number) <= word.length && (
        <g>
          <line
            x1={10}
            y1={TOP + (selStart as number) * CROSS_H}
            x2={n * COL_W + 18}
            y2={TOP + (selStart as number) * CROSS_H}
            stroke="#dc2626"
            strokeWidth={2}
            strokeDasharray="6 5"
          />
          <text x={n * COL_W + 30} y={TOP + (selStart as number) * CROSS_H + 4} className="svg-tag" fill="#dc2626">
            插入点 {(selStart as number)}
          </text>
        </g>
      )}

      {/* 底部端点（编号为该槽位最终的股） */}
      {finalLabels.map((label, slot) => (
        <g key={`bot-${slot}`}>
          <circle cx={x(slot)} cy={h - BOT_PAD + 4} r={3.5} fill={strandColor(label)} />
          <text x={x(slot)} y={h - 8} textAnchor="middle" className="svg-label">
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}
