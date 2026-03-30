// @ts-nocheck
"use client";

import { useDash } from '@/lib/contexts';
import { M } from '@/lib/constants';

export function computeInsights(sel: any) {
  const findings: any[] = [];

  if (sel?.month) {
    findings.push({ id: 'month_delta', type: 'info', text: `${sel.month} selected — check metrics`, section: 'trends' });
    findings.push({ id: 'month_pub', type: 'warn', text: `Check publish status for ${sel.month}`, section: 'trends' });
    findings.push({ id: 'month_rate', type: 'info', text: `Compare vs ${M.publishRate}% platform avg`, section: 'executive' });
  } else if (sel?.channel) {
    findings.push({ id: 'ch_rate', type: 'info', text: `Ch-${sel.channel} pub rate vs ${M.publishRate}% avg`, section: 'multidim' });
    findings.push({ id: 'ch_mult', type: 'info', text: `Ch-${sel.channel} AI multiplier`, section: 'multidim' });
    findings.push({ id: 'ch_plat', type: 'warn', text: `Check platform attribution`, section: 'explorer' });
  } else if (sel?.language) {
    findings.push({ id: 'lang_rate', type: 'info', text: `${sel.language} publish rate`, section: 'multidim' });
    findings.push({ id: 'lang_gap', type: 'warn', text: `EN vs HI gap analysis`, section: 'multidim' });
  } else if (sel?.user) {
    findings.push({ id: 'user_rate', type: 'info', text: `${sel.user} contribution`, section: 'explorer' });
    findings.push({ id: 'user_vol', type: 'info', text: `${sel.user} volume stats`, section: 'explorer' });
  } else {
    // Default global insights
    findings.push({ id: 'pub_gap', type: 'crit', text: `${M.unpubRate}% content never published`, section: 'funnel' });
    findings.push({ id: 'peak', type: 'warn', text: `${M.peakMonth} peak: ${M.peakCreated.toLocaleString()} outputs`, section: 'trends' });
    findings.push({ id: 'zero_months', type: 'crit', text: `${M.zeroPubMonths} months with zero publishes`, section: 'trends' });
    findings.push({ id: 'ch_conc', type: 'warn', text: `Ch-D & Ch-A drive 96% of distribution`, section: 'multidim' });
    findings.push({ id: 'quality', type: 'crit', text: `99.3% unknown team attribution`, section: 'explorer' });
  }

  return findings.slice(0, 5);
}

export default function InsightChips() {
  const dash = useDash();
  if (!dash || !dash.insightMode) return null;

  const { selectedCtx, scrollToSection } = dash;
  const insights = computeInsights(selectedCtx);

  return (
    <div className={`insight-bar${dash.insightMode ? ' visible' : ''}`}>
      {insights.map(item => (
        <div
          key={item.id}
          className="insight-item"
          onClick={() => scrollToSection?.(item.section)}
        >
          <span className={`insight-item-dot ${item.type}`} />
          <span className="insight-item-text">{item.text}</span>
        </div>
      ))}
    </div>
  );
}
