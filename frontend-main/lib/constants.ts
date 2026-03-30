// @ts-nocheck
// ═══════════════════════════════════════════
// FRAMMER v19 — CENTRALIZED METRICS & DATA
// ═══════════════════════════════════════════

export const M = {
  uploaded:    4453,
  created:     15119,
  published:   111,
  unpublished: 15119 - 111,         // 15008
  publishRate: +(111/4453*100).toFixed(1),     // 2.5
  unpubRate:   +((1 - 111/15119)*100).toFixed(1), // 99.3
  multiplier:  +(15119/4453).toFixed(2),        // 3.40
  uploadHrs:   839.8,
  createdHrs:  1314.89,
  activeChannels: 18,
  activeUsers: 44,
  zeroPubMonths: 3,
  peakMonth:   "Feb '26",
  peakCreated: 2756,
  topCh:       'D',
  topChPub:    72,
  topChRate:   17.5,
};
console.assert(M.unpublished === M.created - M.published, 'Unpublished metric mismatch');

export const PUBLISH_RATE = String(M.publishRate);
export const MULTIPLIER   = String(M.multiplier);
export const TOTAL_UPLOADED_M  = M.uploaded;
export const TOTAL_CREATED_M   = M.created;
export const TOTAL_PUBLISHED_M = M.published;

export const STORY_PRESETS = [
  { id:'exec',    title:'Executive Summary',      section:'executive', narrative:'Platform processed 15,119 AI outputs from 4,453 uploads across 12 months. Publish rate of 2.5% reveals a strategic activation gap.' },
  { id:'bottleneck', title:'Publishing Bottleneck', section:'funnel',   narrative:'97.5% of all AI-created content — 15,008 videos — was never distributed. Three months recorded zero publishes.' },
  { id:'channel', title:'Channel Risk',           section:'multidim',  narrative:'12 of 18 channels have zero published output. Ch-D and Ch-A drive 96% of all distribution.' },
  { id:'quality', title:'Quality Risks',          section:'explorer',  narrative:'99.3% unknown team attribution. 68% NULL platform on published rows. QA contamination ~15.5% of created outputs.' },
  { id:'client',  title:'Client Overview',        section:'client',    narrative:'Board-level synthesis: volume, publish funnel, channel health, and data quality summary.' },
];

export const ANOMALIES = [
  { id:'zero_pub_months',   title:'3 Zero-Publish Months',      type:'crit', detail:'Mar, Jul, Sep 2025 had zero published output despite hundreds of uploads. Operational bottleneck — not a volume issue.', affectedMonths:["Mar'25","Jul'25","Sep'25"], section:'trends',   filters:{ months:["Mar'25","Jul'25","Sep'25"] } },
  { id:'feb_spike',         title:'Feb 2026 — Anomalous Spike', type:'warn', detail:"Feb 2026 created 2,756 outputs — 194% above the 12-month average of 937. Upload volume also peaked at 676.", affectedMonths:["Feb'26"], section:'trends',   filters:{ months:["Feb'26"] } },
  { id:'pub_gap',           title:'97.5% Utilization Gap',      type:'crit', detail:'15,008 AI-created videos were never distributed. This is the single largest opportunity on the platform.', section:'funnel',   filters:{} },
  { id:'platform_null',     title:'68% Platform NULL Rate',     type:'crit', detail:'68% of published items have no platform attributed. The data cannot confirm where content was distributed.', section:'explorer', filters:{} },
  { id:'team_unknown',      title:'99.3% Unknown Team',         type:'crit', detail:"99.3% of all records have team name = 'Unknown'. Team-level attribution is currently not functional.", section:'explorer', filters:{} },
  { id:'zero_pub_channels', title:'12/18 Zero-Pub Channels',    type:'crit', detail:'67% of channels have never published a single video. Ch-D and Ch-A account for 96% of all published output.', section:'multidim', filters:{} },
  { id:'qa_contamination',  title:'~15.5% QA/Test Content',     type:'warn', detail:'An estimated 15.5% of created outputs appear to be QA/test artifacts. This inflates the creation count.', section:'explorer', filters:{} },
];

export const SAVED_VIEWS = [
  { id:'executive', name:'Executive View', icon:'◈', desc:'KPIs · pipeline health · top signals', badge:'Overview', section:'executive', panelTab:'evidence', filters:{}, ctx:{}, highlight:'Top-level health check.' },
  { id:'bottlenecks', name:'Publishing Bottlenecks', icon:'⊳', desc:'97.5% gap · zero-pub channels · funnel', badge:'Critical', badgeColor:'red', section:'funnel', panelTab:'evidence', filters:{}, ctx:{}, anomaly:'pub_gap', highlight:'Surfaces why only 111 of 14,914 AI-created videos were distributed.' },
  { id:'language', name:'Language Comparison', icon:'⇔', desc:'English vs Hindi · 3× pub rate gap', badge:'Compare', section:'multidim', panelTab:'compare', filters:{}, ctx:{}, compare:{type:'language',a:'English',b:'Hindi'}, highlight:'English achieves 1.03% vs Hindi 0.33%.' },
  { id:'qa_audit', name:'QA Audit', icon:'⊹', desc:'99.3% unknown team · 68% NULL platform', badge:'Quality', badgeColor:'amber', section:'explorer', panelTab:'evidence', filters:{}, ctx:{}, anomaly:'team_unknown', highlight:'Three critical data quality issues.' },
  { id:'client_review', name:'Client Review', icon:'◎', desc:'Board-ready · account summary · signals', badge:'Private', section:'client', panelTab:'explain', filters:{}, ctx:{}, highlight:'Presentation-ready client overview.' },
];

export const pageTitles: Record<string, string> = {
  executive:'Overview', trends:'Trends', lift:'Lift & Forecast', multidim:'Segments',
  funnel:'Funnel', explorer:'Explorer', client:'Client'
};
