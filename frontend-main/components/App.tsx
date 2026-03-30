// @ts-nocheck
"use client";

const INTRO_KEY = 'frammer-intro-seen-v19';
import useScrollSpy from '@/hooks/useScrollSpy';
import HighlightEscListener from '@/hooks/useHighlightEscListener';
import useJsonData from '@/hooks/useJsonData';
import useLiveMetrics from '@/hooks/useLiveMetrics';

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import ResizableSidebar from "./ui/ResizableSidebar";
import IntroAnimation from "./ui/IntroAnimation";
import SectionClient from "./sections/section-client";
import ToastZone, { useToasts } from "./ui/Toasts";
import SectionExecutive from "./sections/section-executive-command-center";
import SectionTrends from "./sections/section-trends-usage";
import SectionLiftLab from "./sections/section-lift-lab";
import SectionMultiDim from "./sections/section-multi-dim-explorer";
import SectionFunnel from "./sections/section-funnel-flow";
import SectionExplorer from "./sections/section-deep-explorer";
import CommandPalette from "./ui/CommandPalette";
import ContextBar from "./ui/ContextBar";
import InsightChips from "./ui/InsightChips";
import RightPanel from "./ui/RightPanel";
import SectionShell from "./ui/SectionShell";
import RoleSwitcher from "./ui/RoleSwitcher";
import HowToUseModal from "./ui/HowToUseModal";
import { DashContext, AppUICtx } from '@/lib/contexts';
import { M, ANOMALIES, STORY_PRESETS, SAVED_VIEWS, pageTitles } from '@/lib/constants';

/* ── Professional SVG icon map by section key ── */
const NAV_ICONS: Record<string, JSX.Element> = {
  executive: (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8.5" y="1.5" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1.5" y="8.5" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8.5" y="8.5" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  trends: (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polyline points="1.5,11.5 5,7.5 8.5,9.5 13.5,3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="10.5,3.5 13.5,3.5 13.5,6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  multidim: (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1 13.5C1 11 3 9 5.5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="11" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8.5 13.5C8.5 11.2 9.5 9.5 11.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  funnel: (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 2.5H13.5L9.5 7.5V12.5L5.5 11V7.5L1.5 2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  explorer: (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="10" y1="10" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  copilot: (
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2.5C2 1.95 2.45 1.5 3 1.5H12C12.55 1.5 13 1.95 13 2.5V9C13 9.55 12.55 10 12 10H8.5L6 12.5V10H3C2.45 10 2 9.55 2 9V2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <line x1="4.5" y1="4.5" x2="10.5" y2="4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="4.5" y1="6.75" x2="8.5" y2="6.75" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
};

export default function App(props: any) {
  const { data: shellData } = useJsonData("app-shell");
  const { initialSection } = props || {};
  const pagedMode = typeof initialSection === 'string' && initialSection.length > 0;
  const pagedSection = pagedMode ? initialSection : null;

  const theme = "dark";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setTheme = (_: any) => { };
  const [toasts, addToast, removeToast] = useToasts();
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const contentRef = useRef(null);

  // v19 state
  const [cmdOpen, setCmdOpen] = useState(false);
  const [globalFilters, setGlobalFilters] = useState({});
  const [selectedCtx, setSelectedCtx] = useState({});
  const [investigationMode, setInvestigationMode] = useState(null);
  const [investFilters, setInvestFilters] = useState({});
  const [compareState, setCompareState] = useState(null);
  const [storyMode, setStoryMode] = useState(null);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [insightMode, setInsightMode] = useState(false);
  const [pinnedFindings, setPinnedFindings] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('explain');
  const [activeGraphData, setActiveGraphData] = useState([]);
  const [role, setRole] = useState('analyst');
  const [howToUseOpen, setHowToUseOpen] = useState(false);
  const [explorerDeepLink, setExplorerDeepLink] = useState<{ subView?: string, kpiTab?: string } | null>(null);

  // Live metrics from backend (includes raw dashboard with chart_data for sections)
  const { metrics: liveM, isLive, dashboard: liveDashboard } = useLiveMetrics();

  // Chat session (shared between RightPanel copilot and ChatWidget, persisted)
  const [chatSessionId, setChatSessionId] = useState(() => {
    try {
      const stored = typeof window !== "undefined" && localStorage.getItem("frammer_chat");
      if (stored) { const p = JSON.parse(stored); return p.sessionId || null; }
    } catch { }
    return null;
  });

  // Highlight mode
  const [highlightSection, setHighlightSection] = useState(null);

  const handleHighlight = useCallback((sectionId) => {
    setHighlightSection(sectionId);
    if (pagedMode) {
      if (sectionId === 'client') {
        setClientOpen(true);
        setActiveSection('client');
      } else {
        setClientOpen(false);
        setActiveSection(sectionId);
      }
      return;
    }
    requestAnimationFrame(() => {
      const el = contentRef.current?.querySelector(`[data-section="${sectionId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [pagedMode]);

  const exitHighlight = useCallback(() => { setHighlightSection(null); }, []);

  // Intro: localStorage instead of sessionStorage
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem(INTRO_KEY));

  const ALL_SECTIONS = shellData?.sidebar?.sections || [];
  const SCROLL_SECTIONS = ALL_SECTIONS.filter((section) => !section.gated);
  const scrollSectionIds = pagedSection ? [pagedSection] : SCROLL_SECTIONS.map((s) => s.k);

  const [clientOpen, setClientOpen] = useState(pagedSection === 'client');
  const [activeSection, setActiveSection] = useScrollSpy(
    scrollSectionIds,
    contentRef,
    clientOpen,
    !pagedMode,
  );

  // Keep paged mode state in sync when route changes (avoid relying on scroll-spy init only).
  useEffect(() => {
    if (!pagedMode) return;
    setClientOpen(pagedSection === 'client');
    if (pagedSection) setActiveSection(pagedSection);
  }, [pagedMode, pagedSection, setActiveSection]);

  // In paged (single-section) mode, keep the view anchored to the top when switching sections.
  useEffect(() => {
    if (!pagedMode) return;
    if (!contentRef.current) return;
    contentRef.current.scrollTop = 0;
  }, [pagedMode, activeSection, clientOpen]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // ⌘K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
      // ⌘⌥C — open Copilot
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'c') {
        e.preventDefault();
        openPanel('copilot');
      }
      // [ and ] — cycle sections
      if (e.key === '[' && !e.metaKey && !cmdOpen) {
        e.preventDefault();
        const sections = ALL_SECTIONS.map(s => s.k);
        const idx = sections.indexOf(activeSection);
        if (idx > 0) scrollToSection(sections[idx - 1]);
      }
      if (e.key === ']' && !e.metaKey && !cmdOpen) {
        e.preventDefault();
        const sections = ALL_SECTIONS.map(s => s.k);
        const idx = sections.indexOf(activeSection);
        if (idx < sections.length - 1) scrollToSection(sections[idx + 1]);
      }
      // Escape — close overlays in priority order
      if (e.key === 'Escape') {
        if (cmdOpen) { setCmdOpen(false); return; }
        if (highlightSection) { exitHighlight(); return; }
        if (panelOpen) { setPanelOpen(false); return; }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cmdOpen, activeSection, highlightSection, panelOpen]);

  // ── Callbacks ──
  const selectCtx = useCallback((ctx) => {
    setSelectedCtx(prev => ({ ...prev, ...ctx }));
  }, []);

  const startInvestigation = useCallback((anomalyId) => {
    const anomaly = ANOMALIES.find(a => a.id === anomalyId);
    if (!anomaly) return;
    setInvestigationMode(anomalyId);
    setSelectedCtx(prev => ({ ...prev, anomaly: anomalyId }));
    setInvestFilters(anomaly.filters || {});
    const target = anomaly.section || 'executive';
    setActiveSection(target);
    setClientOpen(false);
    if (!pagedMode) {
      requestAnimationFrame(() => {
        const el = contentRef.current?.querySelector(`[data-section="${target}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    addToast(`Investigating: ${anomaly.title}`, 'crit', 'Investigation');
  }, [addToast, pagedMode]);

  const exitInvestigation = useCallback(() => {
    setInvestigationMode(null);
    setInvestFilters({});
    setSelectedCtx(prev => { const n = { ...prev }; delete n.anomaly; return n; });
  }, []);

  const startStory = useCallback((storyId) => {
    const s = STORY_PRESETS.find(x => x.id === storyId);
    if (!s) return;
    setStoryMode(storyId);
    if (s.section === 'client') {
      setClientOpen(true);
      setActiveSection('client');
      if (pagedMode) return;
      // In non-paged mode, scroll the relevant section into view.
    } else {
      setClientOpen(false);
      setActiveSection(s.section);
      if (!pagedMode) {
        requestAnimationFrame(() => {
          const el = contentRef.current?.querySelector(`[data-section="${s.section}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  }, [pagedMode]);

  const exitStory = useCallback(() => { setStoryMode(null); }, []);

  const openCompare = useCallback((typeA, a, typeB, b) => {
    setCompareState({ typeA, a, typeB, b });
    setPanelTab('compare');
    setPanelOpen(true);
  }, []);

  const closeCompare = useCallback(() => { setCompareState(null); }, []);

  const clearAllFilters = useCallback(() => {
    setGlobalFilters({});
    setSelectedCtx({});
    setInvestFilters({});
    setInvestigationMode(null);
    setStoryMode(null);
    setCompareState(null);
    setInsightMode(false);
  }, []);

  const removeChip = useCallback((key, source) => {
    if (source === 'filter' || source === 'both') setGlobalFilters(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (source === 'ctx' || source === 'both') setSelectedCtx(prev => { const n = { ...prev }; delete n[key]; return n; });
  }, []);

  const pinFinding = useCallback((finding) => {
    setPinnedFindings(prev => { if (prev.find(p => p.id === finding.id)) return prev; return [...prev, finding]; });
    addToast(`Pinned: ${finding.label}`, 'info', 'Evidence');
  }, [addToast]);

  const unpinFinding = useCallback((id) => { setPinnedFindings(prev => prev.filter(p => p.id !== id)); }, []);

  const openPanel = useCallback((tab) => {
    setPanelTab(tab || 'explain');
    setPanelOpen(true);
  }, []);

  const handleAskAI = useCallback((graphName, graphData) => {
    if (graphName) {
      setActiveGraphData(prev => {
        const filtered = prev.filter(item => item.name !== graphName);
        return [...filtered, { name: graphName, data: graphData }];
      });
    }
    setPanelTab('copilot');
    setPanelOpen(true);
  }, []);

  const removeGraphData = useCallback((graphName) => {
    setActiveGraphData(prev => prev.filter(item => item.name !== graphName));
  }, []);

  const scrollToSection = useCallback((id) => {
    if (pagedMode) {
      if (id === 'client') {
        setClientOpen(true);
        setActiveSection('client');
      } else {
        setClientOpen(false);
        setActiveSection(id);
      }
      return;
    }

    if (id === 'client') {
      setClientOpen(true);
      setActiveSection('client');
      return;
    }

    if (clientOpen) setClientOpen(false);
    setActiveSection(id);
    const sEl = contentRef.current?.querySelector(`[data-section="${id}"]`);
    if (sEl) sEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [clientOpen, pagedMode, setActiveSection]);

  const navigateToExplorerKPI = useCallback((kpiTab: string) => {
    scrollToSection('explorer');
    setExplorerDeepLink({ subView: 'advanced_kpi', kpiTab });
  }, [scrollToSection]);

  const clearExplorerDeepLink = useCallback(() => setExplorerDeepLink(null), []);

  const goToClient = useCallback(() => {
    setClientOpen(true);
    setActiveSection('client');
  }, [setActiveSection]);

  const backFromClient = useCallback(() => {
    setClientOpen(false);
    setActiveSection('explorer');
    if (pagedMode) return;
    requestAnimationFrame(() => {
      const el = contentRef.current?.querySelector('[data-section="explorer"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [pagedMode, setActiveSection]);

  const renderPagedSection = useCallback(() => {
    if (!activeSection) return null;
    if (activeSection === 'client') return null;
    if (activeSection === 'executive') {
      return (
        <SectionShell
          id="executive"
          title="Executive Overview"
          icon="◈"
          summary={`${(isLive ? liveM.created : M.created).toLocaleString()} AI frames · ${isLive ? liveM.publishRate : M.publishRate}% pub rate · ${isLive ? liveM.activeChannels : M.activeChannels} channels`}
          defaultExpanded={true}
        >
          <SectionExecutive addToast={addToast} theme={theme} onAskAI={handleAskAI} />
        </SectionShell>
      );
    }

    if (activeSection === 'trends') {
      return (
        <SectionShell
          id="trends"
          title="Performance Trends"
          icon="⌇"
          summary="12-month upload vs publish trajectory"
          badge="YoY +23%"
          defaultExpanded={true}
        >
          <SectionTrends theme={theme} onAskAI={handleAskAI} />
        </SectionShell>
      );
    }

    if (activeSection === 'lift') {
      return (
        <SectionShell
          id="lift"
          title="Lift & Forecast Lab"
          icon="⇡"
          summary="Upload CSV or run demo for lift + causal forecast"
          defaultExpanded={true}
        >
          <SectionLiftLab theme={theme} onAskAI={handleAskAI} />
        </SectionShell>
      );
    }

    if (activeSection === 'multidim') {
      return (
        <SectionShell
          id="multidim"
          title="Multi-Dimensional Analysis"
          icon="⬡"
          summary="Channel × content type breakdown"
          defaultExpanded={true}
        >
          <SectionMultiDim theme={theme} onAskAI={handleAskAI} />
        </SectionShell>
      );
    }

    if (activeSection === 'funnel') {
      return (
        <SectionShell
          id="funnel"
          title="Content Funnel"
          icon="▽"
          summary="Upload → Create → Publish conversion"
          defaultExpanded={true}
        >
          <SectionFunnel theme={theme} onAskAI={handleAskAI} />
        </SectionShell>
      );
    }

    if (activeSection === 'explorer') {
      return (
        <SectionShell
          id="explorer"
          title="Explorer"
          icon="⊞"
          summary="Filterable channel × content data table"
          defaultExpanded={true}
        >
          <SectionExplorer theme={theme} onAskAI={handleAskAI} />
        </SectionShell>
      );
    }

    return null;
  }, [activeSection, theme, addToast, handleAskAI]);

  // ── Memos ──
  const activeChips = useMemo(() => {
    const chips = [];
    if (selectedCtx.channel) chips.push({ label: `Ch-${selectedCtx.channel}`, key: 'channel', source: 'ctx' });
    if (selectedCtx.month) chips.push({ label: selectedCtx.month, key: 'month', source: 'ctx' });
    if (selectedCtx.language) chips.push({ label: selectedCtx.language, key: 'language', source: 'ctx' });
    if (selectedCtx.user) chips.push({ label: selectedCtx.user, key: 'user', source: 'ctx' });
    if (globalFilters.inputType) chips.push({ label: globalFilters.inputType, key: 'inputType', source: 'filter' });
    return chips;
  }, [selectedCtx, globalFilters]);

  const filteredData = useMemo(() => {
    // Compute filtered slices based on selectedCtx, globalFilters, investFilters
    const isFiltered = Object.keys(selectedCtx).length > 0 || Object.keys(globalFilters).length > 0 || Object.keys(investFilters).length > 0;
    return { isFiltered, activeFilter: { ...selectedCtx, ...globalFilters, ...investFilters } };
  }, [selectedCtx, globalFilters, investFilters]);

  const breadcrumb = useMemo(() => {
    const parts = [pageTitles[activeSection] || 'Overview'];
    if (selectedCtx.channel) parts.push(`Ch-${selectedCtx.channel}`);
    if (selectedCtx.month) parts.push(selectedCtx.month);
    if (selectedCtx.language) parts.push(selectedCtx.language);
    if (selectedCtx.user) parts.push(selectedCtx.user);
    return parts;
  }, [activeSection, selectedCtx]);

  const dashCtx = useMemo(() => ({
    selectCtx, selectedCtx, startInvestigation, exitInvestigation,
    openCompare, closeCompare, filteredData, pinFinding, unpinFinding,
    openPanel, investigationMode, storyMode, compareState,
    activeChips, removeChip, clearAllFilters, exitStory, startStory,
    insightMode, setInsightMode, showBenchmark, setShowBenchmark,
    pinnedFindings, scrollToSection, addToast,
    liveDashboard, isLive,
    navigateToExplorerKPI, explorerDeepLink, clearExplorerDeepLink,
  }), [
    selectCtx, selectedCtx, startInvestigation, exitInvestigation,
    openCompare, closeCompare, filteredData, pinFinding, unpinFinding,
    openPanel, investigationMode, storyMode, compareState,
    activeChips, removeChip, clearAllFilters, exitStory, startStory,
    insightMode, showBenchmark, pinnedFindings, scrollToSection, addToast,
    liveDashboard, isLive,
    navigateToExplorerKPI, explorerDeepLink, clearExplorerDeepLink,
  ]);

  const appUICtx = useMemo(() => ({
    panelOpen, setPanelOpen, panelTab, setPanelTab, openPanel,
  }), [panelOpen, panelTab, openPanel]);

  // Command palette action handler
  const handleCmdAction = useCallback((action) => {
    if (!action) return;
    switch (action.type) {
      case 'nav': scrollToSection(action.target); break;
      case 'panel': openPanel(action.tab); break;
      case 'investigate': startInvestigation(action.id); openPanel('evidence'); break;
      case 'compare': openCompare(action.typeA, action.a, action.typeB, action.b); break;
      case 'clear': clearAllFilters(); break;
      case 'insights': setInsightMode(v => !v); break;
    }
  }, [scrollToSection, openPanel, startInvestigation, openCompare, clearAllFilters]);

  return (
    <DashContext.Provider value={dashCtx}>
      <AppUICtx.Provider value={appUICtx}>
        <>
          {showIntro && (
            <IntroAnimation
              onDone={() => {
                localStorage.setItem(INTRO_KEY, "1");
                setShowIntro(false);
              }}
            />
          )}

          <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onAction={handleCmdAction} />
          <HowToUseModal open={howToUseOpen} onClose={() => setHowToUseOpen(false)} />

          <div
            className="shell"
            style={{
              opacity: showIntro ? 0 : 1,
              transition: "opacity 0.5s ease 0.15s",
              transform: showIntro ? "scale(0.995)" : "scale(1)",
              transitionProperty: "opacity,transform",
            }}
          >
            {/* ── SIDEBAR ── */}
            <ResizableSidebar collapsed={sideCollapsed} setCollapsed={setSideCollapsed}>
              <div className="sidebar-logo">
                {sideCollapsed ? (
                  <button
                    className="logo-f-btn"
                    onClick={() => setSideCollapsed(false)}
                    title="Expand sidebar"
                    aria-label="Expand sidebar"
                  >
                    F
                  </button>
                ) : (
                  <div className="logo-lockup">
                    <span className="logo-wordmark">FRAMMER <em>AI</em></span>
                    <div className="logo-live-dot" />
                  </div>
                )}
              </div>

              <div className="sidebar-body">
                <div className="nav-grp">SECTIONS</div>
                <nav className="nav-list">
                  {ALL_SECTIONS.filter(s => s.k !== "client").map((s) => (
                    <div
                      key={s.k}
                      className={`nav-item${activeSection === s.k ? " active" : ""}`}
                      onClick={() => scrollToSection(s.k)}
                    >
                      <span className="nav-icon">{NAV_ICONS[s.k] || s.icon}</span>
                      <span className="nav-label">{pageTitles[s.k] || s.label}</span>
                    </div>
                  ))}
                </nav>

                <div style={{ margin: "16px 0 8px" }}>
                  <div className="nav-grp">TOOLS</div>
                  <div
                    onClick={() => { window.location.href = '/analyze'; }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      margin: '4px 8px', padding: '9px 14px',
                      borderRadius: 8,
                      background: 'rgba(48,201,120,0.10)',
                      border: '1px solid rgba(48,201,120,0.28)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      boxShadow: '0 0 14px rgba(48,201,120,0.08)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(48,201,120,0.17)';
                      e.currentTarget.style.borderColor = 'rgba(48,201,120,0.45)';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(48,201,120,0.15)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(48,201,120,0.10)';
                      e.currentTarget.style.borderColor = 'rgba(48,201,120,0.28)';
                      e.currentTarget.style.boxShadow = '0 0 14px rgba(48,201,120,0.08)';
                    }}
                  >
                    <span style={{
                      width: 20, height: 20, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexShrink: 0, color: 'rgba(72,220,140,0.90)',
                    }}>
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7.5 1.5V10M7.5 1.5L4.5 4.5M7.5 1.5L10.5 4.5" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2 11V12.5C2 13.05 2.45 13.5 3 13.5H12C12.55 13.5 13 13.05 13 12.5V11" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round"/>
                      </svg>
                    </span>
                    <span style={{
                      flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
                      color: 'rgba(72,220,140,0.92)', letterSpacing: '0.01em',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      Upload &amp; Analyze
                    </span>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'rgba(72,220,140,0.85)', flexShrink: 0,
                      boxShadow: '0 0 6px rgba(72,220,140,0.60)',
                    }} />
                  </div>
                </div>

                <div style={{ margin: "16px 0 8px" }}>
                  <div className="nav-grp">WORKSPACE</div>
                  <nav className="nav-list">
                    <div className={`nav-item${panelOpen && panelTab === 'copilot' ? ' active' : ''}`} onClick={() => openPanel('copilot')}>
                      <span className="nav-icon">{NAV_ICONS.copilot}</span>
                      <span className="nav-label">Copilot</span>
                    </div>
                  </nav>
                </div>
                <div className="sb-stats">
                  <div className="nav-grp" style={{ paddingTop: 12 }}>
                    Platform
                  </div>
                  {(shellData?.sidebar?.platformKpis || []).map((s) => (
                    <div key={s.l} className="sb-row">
                      <span className="sb-lbl">{s.l}</span>
                      <span className="sb-val" style={{ color: s.c }}>{s.v}</span>
                    </div>
                  ))}
                </div>
                <div className="sb-foot">
                  v19 · <span style={{ color: 'var(--suc)', opacity: 0.9 }}>● live</span>
                </div>
              </div>
            </ResizableSidebar>

            {/* ── MAIN ── */}
            <div className="main" style={{ marginRight: panelOpen ? 'var(--panel-w)' : 0, transition: 'margin-right 0.24s var(--ease-out)' }}>
              {/* Topbar */}
              <div className="topbar">
                {/* Left — period chip */}
                <div className="topbar-left">
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 12px",
                    background: "rgba(255,255,255,0.03)",
                    border: "0.5px solid rgba(255,255,255,0.08)",
                    borderRadius: 5,
                    flexShrink: 0,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(48,209,88,0.7)", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontFamily: "var(--font-sans)", fontWeight: 500, color: "rgba(255,255,255,0.60)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                      {shellData?.sidebar?.period?.value || "Mar 2025 → Feb 2026"}
                    </span>
                    <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.10)", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontFamily: "var(--font-sans)", color: "rgba(255,255,255,0.28)", whiteSpace: "nowrap" }}>
                      {shellData?.sidebar?.period?.sub || "12 months"}
                    </span>
                  </div>
                  {breadcrumb.length > 1 && (
                    <div className="breadcrumb" style={{ marginLeft: 4 }}>
                      {breadcrumb.map((item, i) => (
                        <span key={i}>
                          {i > 0 && <span className="breadcrumb-sep">›</span>}
                          <span className={`breadcrumb-item${i === breadcrumb.length - 1 ? ' active' : ''}`}>{item}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Center — elongated search */}
                <div style={{
                  position: "absolute", left: "50%", transform: "translateX(-50%)",
                  display: "flex", alignItems: "center", pointerEvents: "all", zIndex: 5,
                  /* clamp so it never visually overlaps left pill or right buttons */
                  maxWidth: panelOpen ? 280 : 360,
                  transition: "max-width 0.20s ease",
                }}>
                  <div
                    className="cmd-trigger"
                    onClick={() => setCmdOpen(true)}
                    style={{ width: panelOpen ? 280 : 360, justifyContent: "flex-start", transition: "width 0.20s ease" }}
                  >
                    <span style={{ fontSize: 15, opacity: 0.45, flexShrink: 0, lineHeight: 1 }}>⌕</span>
                    <span className="cmd-trigger-text" style={{ flex: 1, textAlign: "left" }}>Search anything…</span>
                    <span className="cmd-trigger-kbd">⌘K</span>
                  </div>
                </div>

                {/* Right — actions */}
                <div className="topbar-right">
                  {/* Upload CSV — collapses to icon-only when panel is open */}
                  {/* <button
                    onClick={() => {}}
                    title="Upload CSV data"
                    style={{
                      display: "flex", alignItems: "center", gap: panelOpen ? 0 : 7,
                      padding: panelOpen ? "0 9px" : "0 14px", height: 32,
                      background: "rgba(24,167,104,0.12)",
                      border: "1px solid rgba(24,167,104,0.40)",
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "var(--font-ui)",
                      fontWeight: 600,
                      letterSpacing: "0.03em",
                      color: "#3EC98A",
                      cursor: "pointer",
                      flexShrink: 0,
                      transition: "all 0.20s ease",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "rgba(24,167,104,0.22)";
                      e.currentTarget.style.borderColor = "rgba(62,201,138,0.65)";
                      e.currentTarget.style.boxShadow = "0 0 14px rgba(24,167,104,0.25)";
                      e.currentTarget.style.color = "#5DDDAA";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "rgba(24,167,104,0.12)";
                      e.currentTarget.style.borderColor = "rgba(24,167,104,0.40)";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.color = "#3EC98A";
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2"/>
                      <line x1="6.5" y1="3.5" x2="6.5" y2="9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      <line x1="3.5" y1="6.5" x2="9.5" y2="6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <span style={{
                      maxWidth: panelOpen ? 0 : 80,
                      overflow: "hidden",
                      opacity: panelOpen ? 0 : 1,
                      marginLeft: panelOpen ? 0 : undefined,
                      transition: "max-width 0.20s ease, opacity 0.15s ease",
                      whiteSpace: "nowrap",
                    }}>Upload CSV</span>
                  </button> */}

                  {/* Divider */}
                  <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

                  <button
                    onClick={() => {
                      if (panelOpen && panelTab === 'copilot') {
                        setPanelOpen(false);
                      } else {
                        openPanel('copilot');
                      }
                    }}
                    title={panelOpen && panelTab === 'copilot' ? "Close Copilot" : "Open AI Copilot"}
                    style={{
                      background: panelOpen && panelTab === 'copilot' ? "rgba(232,67,45,0.10)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${panelOpen && panelTab === 'copilot' ? "rgba(232,67,45,0.38)" : "rgba(255,255,255,0.09)"}`,
                      borderRadius: 7,
                      padding: "5px 13px 5px 10px",
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      color: panelOpen && panelTab === 'copilot' ? "rgba(232,100,80,1)" : "rgba(255,255,255,0.45)",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 7,
                      flexShrink: 0,
                      transition: "all 0.18s ease",
                      letterSpacing: "0.04em",
                      boxShadow: panelOpen && panelTab === 'copilot' ? "0 0 12px rgba(232,67,45,0.12)" : "none",
                    }}
                    onMouseEnter={e => { if (!(panelOpen && panelTab === 'copilot')) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; e.currentTarget.style.background = "rgba(255,255,255,0.055)"; } }}
                    onMouseLeave={e => { if (!(panelOpen && panelTab === 'copilot')) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; } }}
                  >
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, opacity: panelOpen && panelTab === 'copilot' ? 1 : 0.75 }}>
                      <path d="M2 2.5C2 1.95 2.45 1.5 3 1.5H12C12.55 1.5 13 1.95 13 2.5V9C13 9.55 12.55 10 12 10H8.5L6 12.5V10H3C2.45 10 2 9.55 2 9V2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                      <line x1="4.5" y1="4.5" x2="10.5" y2="4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                      <line x1="4.5" y1="6.75" x2="8.5" y2="6.75" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                    </svg>
                    Copilot
                  </button>

                  <button
                    onClick={() => setHowToUseOpen(true)}
                    title="How to use"
                    style={{
                      background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 5,
                      width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 13,
                      flexShrink: 0, transition: "all 0.15s", fontFamily: "var(--font-sans)",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)"; e.currentTarget.style.color = "rgba(255,255,255,0.70)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
                  >
                    ?
                  </button>

                  {/* Divider */}
                  <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

                  {/* Client — rightmost, premium */}
                  {clientOpen ? (
                    <button
                      className="ctrl-btn"
                      onClick={backFromClient}
                      style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Back
                    </button>
                  ) : (
                    <button
                      onClick={goToClient}
                      title="Client view"
                      style={{
                        display: "flex", alignItems: "center", gap: panelOpen ? 6 : 8,
                        padding: panelOpen ? "0 10px" : "0 16px", height: 34,
                        background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        borderRadius: 8,
                        fontSize: 12,
                        fontFamily: "var(--font-ui)",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        color: "rgba(255,255,255,0.70)",
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "all 0.20s ease",
                        textTransform: "uppercase",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.07) 100%)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)";
                        e.currentTarget.style.color = "#ffffff";
                        e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(0,0,0,0.25)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
                        e.currentTarget.style.color = "rgba(255,255,255,0.70)";
                        e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.08)";
                      }}
                    >
                      {/* Premium person/user icon */}
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                        <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M1.5 12.5C1.5 10.015 4.015 8 7 8C9.985 8 12.5 10.015 12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                      {!panelOpen && "Client"}
                      {panelOpen && <span style={{ fontSize: 11, letterSpacing: '0.03em' }}>Client</span>}
                    </button>
                  )}
                </div>
              </div>

              {/* Insight Chips */}
              <InsightChips />

              {/* Main scrollable sections with progressive disclosure */}
              {!clientOpen && (
                <div className="content" ref={contentRef} style={{ padding: '20px 24px' }}>
                  {pagedMode ? (
                    renderPagedSection()
                  ) : (
                    <>
                      <SectionShell
                        id="executive" title="Executive Overview" icon="◈"
                        summary={`${(isLive ? liveM.created : M.created).toLocaleString()} AI frames · ${isLive ? liveM.publishRate : M.publishRate}% pub rate · ${isLive ? liveM.activeChannels : M.activeChannels} channels`}
                        defaultExpanded={true}
                      >
                        <SectionExecutive addToast={addToast} theme={theme} onAskAI={handleAskAI} />
                      </SectionShell>

                      <SectionShell
                        id="trends" title="Performance Trends" icon="⌇"
                        summary="12-month upload vs publish trajectory"
                        badge="YoY +23%"
                      >
                        <SectionTrends theme={theme} onAskAI={handleAskAI} />
                      </SectionShell>

                      <SectionShell
                        id="lift" title="Lift & Forecast Lab" icon="⇡"
                        summary="Upload CSV or run demo for lift + causal forecast"
                        badge="Demo"
                      >
                        <SectionLiftLab theme={theme} onAskAI={handleAskAI} />
                      </SectionShell>

                      <SectionShell
                        id="multidim" title="Multi-Dimensional Analysis" icon="⬡"
                        summary="Channel × content type breakdown"
                      >
                        <SectionMultiDim theme={theme} onAskAI={handleAskAI} />
                      </SectionShell>

                      <SectionShell
                        id="funnel" title="Content Funnel" icon="▽"
                        summary="Upload → Create → Publish conversion"
                      >
                        <SectionFunnel theme={theme} onAskAI={handleAskAI} />
                      </SectionShell>

                      <SectionShell
                        id="explorer" title="Explorer" icon="⊞"
                        summary="Filterable channel × content data table"
                      >
                        <SectionExplorer theme={theme} onAskAI={handleAskAI} />
                      </SectionShell>
                    </>
                  )}
                </div>
              )}

              {/* Client panel */}
              {clientOpen && (
                <div className="content" style={{ flex: 1, overflowY: "auto" }}>
                  <div className="section-block fade-up" style={{ paddingBottom: 80 }}>
                    <SectionClient onClose={backFromClient} onAskAI={handleAskAI} />
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel */}
            <RightPanel
              open={panelOpen}
              activeTab={panelTab}
              setActiveTab={setPanelTab}
              onClose={() => setPanelOpen(false)}
              attachedData={activeGraphData}
              onRemoveData={removeGraphData}
              chatSessionId={chatSessionId}
              onChatSessionId={setChatSessionId}
            />

            <ToastZone toasts={toasts} remove={removeToast} />

            {/* Highlight overlay */}
            {highlightSection && (
              <>
                <div
                  style={{
                    position: "fixed", inset: 0, zIndex: 7000,
                    background: "rgba(0,0,0,0.4)", pointerEvents: "all",
                  }}
                  onClick={exitHighlight}
                />
                <div
                  style={{
                    position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
                    background: "var(--bg2)", border: "1px solid rgba(255,71,87,0.28)",
                    borderRadius: 6, padding: "8px 20px", fontFamily: "var(--font-mono)",
                    fontSize: 10, color: "var(--pri-lt)", zIndex: 7020, pointerEvents: "none",
                    letterSpacing: "0.08em", boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Click anywhere to exit spotlight · ESC
                </div>
                <HighlightEscListener onEscape={exitHighlight} />
              </>
            )}
          </div>
        </>
      </AppUICtx.Provider>
    </DashContext.Provider>
  );
}
