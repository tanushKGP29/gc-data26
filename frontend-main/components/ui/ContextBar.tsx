// @ts-nocheck
"use client";

import { useDash } from '@/lib/contexts';
import { useAppUI } from '@/lib/contexts';
import { ANOMALIES } from '@/lib/constants';

export default function ContextBar() {
  const dash = useDash();
  const ui = useAppUI();

  if (!dash) return null;

  const {
    selectedCtx, investigationMode, storyMode, compareState,
    activeChips, removeChip, clearAllFilters, exitInvestigation,
    exitStory, closeCompare, insightMode, setInsightMode, filteredData
  } = dash;

  const hasAny = activeChips?.length > 0 || investigationMode || storyMode || compareState;
  const anomaly = investigationMode ? ANOMALIES.find(a => a.id === investigationMode) : null;

  return (
    <div className="ctx-bar">
      <span className="ctx-label">Context</span>
      <span className="ctx-divider" />

      {/* Investigation mode pill */}
      {investigationMode && anomaly && (
        <span className="mode-pill invest" onClick={exitInvestigation}>
          <span className="mode-pill-dot" />
          {anomaly.title}
          <span className="mode-pill-x">✕</span>
        </span>
      )}

      {/* Story mode pill */}
      {storyMode && (
        <span className="mode-pill story" onClick={exitStory}>
          <span className="mode-pill-dot" />
          Story Mode
          <span className="mode-pill-x">✕</span>
        </span>
      )}

      {/* Compare mode pill */}
      {compareState && (
        <span className="mode-pill compare" onClick={closeCompare}>
          <span className="mode-pill-dot" />
          Compare: {compareState.a} vs {compareState.b}
          <span className="mode-pill-x">✕</span>
        </span>
      )}

      {/* Filter chips */}
      {activeChips?.map(chip => (
        <span key={chip.key} className="f-chip" onClick={() => removeChip(chip.key, chip.source)}>
          {chip.label}
          <span className="f-chip-x">✕</span>
        </span>
      ))}

      {/* Filtered badge */}
      {filteredData?.isFiltered && (
        <span className="badge badge-gold">filtered</span>
      )}

      {/* Hint when nothing active */}
      {!hasAny && (
        <span className="ctx-hint">Click any chart, row, or data point to filter</span>
      )}

      <span className="ctx-spacer" />

      {/* Reset button */}
      {hasAny && (
        <button className="ctx-reset" onClick={clearAllFilters}>↺ Reset all</button>
      )}

      {/* Insights toggle */}
      <button
        className={`insight-toggle${insightMode ? ' active' : ''}`}
        onClick={() => setInsightMode(v => !v)}
      >
        <span className="insight-toggle-dot" />
        Insights
      </button>
    </div>
  );
}
