// @ts-nocheck
"use client";

import { useState } from 'react';
import { useDash } from '@/lib/contexts';

export default function SectionShell({ id, title, icon, summary, badge, defaultExpanded = false, children }: any) {
  const dash = useDash();
  const isActive = dash?.activeSection === id || dash?.scrollToSection;
  const [expandedByUser, setExpandedByUser] = useState(defaultExpanded);
  const expanded = Boolean(isActive || expandedByUser);

  return (
    <div
      className={`section-shell ${expanded ? 'expanded' : 'collapsed'} ${isActive ? 'active' : ''}`}
      data-section={id}
    >
      <button
        className="section-shell-header"
        onClick={() => setExpandedByUser(v => !v)}
        aria-expanded={expanded}
      >
        <div className="section-shell-meta">
          <span className="section-shell-title">{title}</span>
          {!expanded && summary && <span className="section-shell-summary">{summary}</span>}
        </div>
        {badge && <span className="section-shell-badge">{badge}</span>}
        <span className="section-shell-chevron">{expanded ? '⌃' : '⌄'}</span>
      </button>

      {expanded && (
        <div className="section-shell-body fade-up">
          {children}
        </div>
      )}
    </div>
  );
}
