// @ts-nocheck
"use client";

import { useState, useEffect, useRef, useMemo } from 'react';

const ALL_COMMANDS = [
  // Navigate
  { group: 'Navigate', icon: '◈', label: 'Overview', desc: 'Executive dashboard', action: { type: 'nav', target: 'executive' }, kbd: '1' },
  { group: 'Navigate', icon: '⊳', label: 'Trends', desc: 'Usage & trend analysis', action: { type: 'nav', target: 'trends' }, kbd: '2' },
  { group: 'Navigate', icon: '⊿', label: 'Lift & Forecast', desc: 'ML lift scoring & forecasting', action: { type: 'nav', target: 'lift' }, kbd: '3' },
  { group: 'Navigate', icon: '⊞', label: 'Segments', desc: 'Channel & user intelligence', action: { type: 'nav', target: 'multidim' }, kbd: '4' },
  { group: 'Navigate', icon: '⊳', label: 'Funnel', desc: 'Content mix & publishing funnel', action: { type: 'nav', target: 'funnel' }, kbd: '5' },
  { group: 'Navigate', icon: '⊹', label: 'Explorer', desc: 'Data explorer & quality', action: { type: 'nav', target: 'explorer' }, kbd: '6' },
  { group: 'Navigate', icon: '◎', label: 'Client', desc: 'Client profile (gated)', action: { type: 'nav', target: 'client' }, kbd: '7' },
  // Workspace
  { group: 'Workspace', icon: '⊹', label: 'Copilot', desc: 'AI assistant', action: { type: 'panel', tab: 'copilot' } },
];

export default function CommandPalette({ open, onClose, onAction }: { open: boolean; onClose: () => void; onAction: (action: any) => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_COMMANDS;
    const q = query.toLowerCase();
    return ALL_COMMANDS.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q)
    );
  }, [query]);

  const groups = useMemo(() => {
    const map: Record<string, typeof ALL_COMMANDS> = {};
    filtered.forEach(c => {
      if (!map[c.group]) map[c.group] = [];
      map[c.group].push(c);
    });
    return map;
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      else if (e.key === 'Enter' && filtered[selected]) { e.preventDefault(); onAction(filtered[selected].action); onClose(); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selected, onAction, onClose]);

  if (!open) return null;

  let flatIdx = -1;

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={e => e.stopPropagation()}>
        <div className="cmd-search-row">
          <span className="cmd-search-icon">⌕</span>
          <input
            ref={inputRef}
            className="cmd-search-input"
            placeholder="Search commands and views..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
          />
          <span className="cmd-esc">ESC</span>
        </div>
        <div className="cmd-results">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="cmd-group-label">{group}</div>
              {items.map((cmd) => {
                flatIdx++;
                const idx = flatIdx;
                return (
                  <div
                    key={cmd.label}
                    className={`cmd-item${idx === selected ? ' selected' : ''}`}
                    onClick={() => { onAction(cmd.action); onClose(); }}
                    onMouseEnter={() => setSelected(idx)}
                  >
                    <div className="cmd-item-icon">{cmd.icon}</div>
                    <div className="cmd-item-info">
                      <div className="cmd-item-label">{cmd.label}</div>
                      <div className="cmd-item-desc">{cmd.desc}</div>
                    </div>
                    {cmd.kbd && <span className="cmd-item-kbd">{cmd.kbd}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="empty-state" style={{ padding: '24px 20px' }}>
              <div className="empty-state-icon">⌕</div>
              <div className="empty-state-text">No commands match "{query}"</div>
            </div>
          )}
        </div>
        <div className="cmd-footer">
          <div className="cmd-footer-hint">
            <kbd>↑↓</kbd> navigate <kbd>↵</kbd> select <kbd>esc</kbd> close
          </div>
        </div>
      </div>
    </div>
  );
}
