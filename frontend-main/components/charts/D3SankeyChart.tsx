// @ts-nocheck
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import * as d3 from 'd3';
import { useRef, useEffect, useCallback } from "react";

function D3SankeyChart({ type = "funnel", theme, dataMap = {} }) {
  const ref = useRef(null);
  const dark = theme !== "light";

  const getSankeyData = useCallback((t) => {
    const sectionData = dataMap[t];
    if (!sectionData) return { nodes: [], links: [] };
    const nodes = (sectionData.nodes || []).map((name) => ({ name }));
    const idx = (n) => nodes.findIndex((x) => x.name === n);
    const links = (sectionData.links || []).map((link) => ({
      source: typeof link.source === "number" ? link.source : idx(link.source),
      target: typeof link.target === "number" ? link.target : idx(link.target),
      value: link.value,
    }));
    return { nodes, links };
  }, [dataMap]);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = "";
    container.style.position = "relative";

    const W = container.clientWidth || 700;
    const H = 400;
    const { nodes, links } = getSankeyData(type);
    if (!nodes.length) return;

    const textColor   = dark ? "#f5f5f7"                    : "#0e0f11";
    const mutedColor  = dark ? "rgba(245,245,247,0.42)"     : "rgba(14,15,17,0.42)";
    const tipBg       = dark ? "rgba(12,13,15,0.96)"        : "rgba(255,255,255,0.97)";
    const tipBorder   = dark ? "rgba(255,71,87,0.28)"       : "rgba(14,15,17,0.14)";
    const tipShadow   = dark
      ? "0 12px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,71,87,0.09)"
      : "0 8px 28px rgba(0,0,0,0.13)";

    const COLORS = [
      "#ff4757", "#1D9E75", "#3EC98A", "#0F6E56",
      "rgba(255,71,87,0.82)", "rgba(62,201,138,0.82)",
      "#ff6b7a", "#26de81", "#e74c3c", "#20bf6b",
      "rgba(255,71,87,0.60)", "rgba(255,255,255,0.60)",
      "rgba(255,71,87,0.42)", "rgba(62,201,138,0.55)",
      "#a55eea", "#45aaf2",
    ];

    /* ── SVG ── */
    const svg = d3.select(container)
      .append("svg")
      .attr("width", "100%")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .style("display", "block")
      .style("overflow", "visible");

    /* ── Defs: glow filters ── */
    const defs = svg.append("defs");

    const makeGlow = (id, blur) => {
      const f = defs.append("filter").attr("id", id)
        .attr("x", "-40%").attr("y", "-40%").attr("width", "180%").attr("height", "180%");
      f.append("feGaussianBlur").attr("in", "SourceGraphic")
        .attr("stdDeviation", blur).attr("result", "bl");
      const m = f.append("feMerge");
      m.append("feMergeNode").attr("in", "bl");
      m.append("feMergeNode").attr("in", "SourceGraphic");
    };
    makeGlow("sk-glow", 2.5);
    makeGlow("sk-glow2", 5.5);

    /* ── Sankey layout ── */
    const sankeyInst = sankey()
      .nodeWidth(14)
      .nodePadding(type === "funnel" ? 28 : 10)
      .extent([[40, 22], [W - 148, H - 22]]);

    let sdata;
    try {
      sdata = sankeyInst({
        nodes: nodes.map(d => Object.assign({}, d)),
        links: links.map(d => Object.assign({}, d)),
      });
    } catch { return; }

    const { nodes: N, links: L } = sdata;

    /* ── Gradients (rebuilt on demand) ── */
    const buildGrads = () => {
      defs.selectAll("linearGradient").remove();
      L.forEach((l, i) => {
        const sc = COLORS[l.source.index % COLORS.length];
        const tc = COLORS[l.target.index % COLORS.length];

        const g = defs.append("linearGradient")
          .attr("id", `sg${i}`).attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", l.source.x1).attr("x2", l.target.x0);
        g.append("stop").attr("offset", "0%").attr("stop-color", sc).attr("stop-opacity", 0.42);
        g.append("stop").attr("offset", "100%").attr("stop-color", tc).attr("stop-opacity", 0.22);

        const gh = defs.append("linearGradient")
          .attr("id", `sgh${i}`).attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", l.source.x1).attr("x2", l.target.x0);
        gh.append("stop").attr("offset", "0%").attr("stop-color", sc).attr("stop-opacity", 0.92);
        gh.append("stop").attr("offset", "100%").attr("stop-color", tc).attr("stop-opacity", 0.72);
      });
    };
    buildGrads();

    /* ── Tooltip ── */
    const tip = d3.select(container).append("div")
      .style("position",       "absolute")
      .style("pointer-events", "none")
      .style("opacity",        "0")
      .style("transition",     "opacity 0.14s ease")
      .style("background",     tipBg)
      .style("border",         `1px solid ${tipBorder}`)
      .style("border-radius",  "9px")
      .style("padding",        "10px 14px")
      .style("font-family",    "var(--font-ibm-plex-mono, monospace)")
      .style("font-size",      "11px")
      .style("color",          textColor)
      .style("box-shadow",     tipShadow)
      .style("backdrop-filter","blur(18px)")
      .style("-webkit-backdrop-filter", "blur(18px)")
      .style("z-index",        "100")
      .style("min-width",      "148px")
      .style("max-width",      "240px")
      .style("line-height",    "1.55");

    const showTip = (ev, html) => {
      const [mx, my] = d3.pointer(ev, container);
      tip.html(html).style("opacity", "1")
        .style("left", (mx + 16) + "px")
        .style("top",  (my - 10) + "px");
    };
    const moveTip = (ev) => {
      const [mx, my] = d3.pointer(ev, container);
      tip.style("left", (mx + 16) + "px").style("top", (my - 10) + "px");
    };
    const hideTip = () => tip.style("opacity", "0");

    const fmtV = v => v >= 1000 ? (v / 1000).toFixed(1) + "k" : String(v);

    /* ── State ── */
    let activeNode = null;   // node currently in drag mode

    /* ── Helpers ── */
    const resetAll = () => {
      lPaths.attr("opacity", 0.74).attr("stroke", (_, i) => `url(#sg${i})`);
      nRects.attr("opacity", 0.9).attr("filter", "none").attr("stroke", "none");
      nTexts.attr("opacity", 1);
    };

    const updateDOM = () => {
      nRects.attr("x", d => d.x0).attr("y", d => d.y0)
            .attr("width", d => d.x1 - d.x0)
            .attr("height", d => Math.max(4, d.y1 - d.y0));
      nTexts.attr("x", d => d.x0 > W / 2 ? d.x0 - 8 : d.x1 + 8)
            .attr("y", d => (d.y0 + d.y1) / 2);
      lPaths.attr("d", sankeyLinkHorizontal());
    };

    const syncDragRing = (nd) => {
      if (!nd) { dragRing.attr("opacity", 0); dragHint.attr("opacity", 0); return; }
      const cx = (nd.x0 + nd.x1) / 2;
      dragRing.attr("x", nd.x0 - 4).attr("y", nd.y0 - 4)
        .attr("width",  nd.x1 - nd.x0 + 8)
        .attr("height", nd.y1 - nd.y0 + 8)
        .attr("opacity", 0.9);
      dragHint.attr("x", cx).attr("y", nd.y0 - 11).attr("opacity", 1);
    };

    /* ── Transparent click-catcher background ── */
    svg.append("rect")
      .attr("x", 0).attr("y", 0).attr("width", W).attr("height", H)
      .attr("fill", "transparent")
      .style("cursor", "default")
      .on("click", () => {
        if (!activeNode) return;
        const prev = activeNode;
        activeNode = null;
        resetAll();
        syncDragRing(null);
        nRects.filter(n => n === prev).attr("filter", "none").attr("stroke", "none");
      });

    /* ── Links ── */
    const lPaths = svg.append("g").selectAll("path").data(L).join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke",       (_, i) => `url(#sg${i})`)
      .attr("stroke-width", d => Math.max(1.5, d.width))
      .attr("fill",         "none")
      .attr("opacity",      0.74)
      .style("cursor",      "crosshair")
      .on("mouseover", function(ev, d) {
        if (activeNode) return;
        lPaths.attr("opacity", l => l === d ? 1 : 0.10)
              .attr("stroke",   (l, i) => `url(#${l === d ? "sgh" : "sg"}${i})`);
        nRects.attr("opacity", n => (n === d.source || n === d.target) ? 1 : 0.16)
              .attr("filter",  n => (n === d.source || n === d.target) ? "url(#sk-glow2)" : "none");
        nTexts.attr("opacity", n => (n === d.source || n === d.target) ? 1 : 0.16);

        const sc = COLORS[d.source.index % COLORS.length];
        const tc = COLORS[d.target.index % COLORS.length];
        showTip(ev, `
          <div style="color:${mutedColor};font-size:9px;letter-spacing:.07em;text-transform:uppercase;margin-bottom:6px">FLOW</div>
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:7px">
            <span style="color:${sc};font-weight:700">${d.source.name}</span>
            <span style="color:${mutedColor};font-size:12px">→</span>
            <span style="color:${tc};font-weight:700">${d.target.name}</span>
          </div>
          <div style="font-size:14px;font-weight:800;color:${textColor};letter-spacing:-.01em">${fmtV(d.value)}</div>
          <div style="color:${mutedColor};font-size:9px;margin-top:2px">units transferred</div>`);
      })
      .on("mousemove", moveTip)
      .on("mouseout", function() {
        if (activeNode) return;
        resetAll(); hideTip();
      });

    /* ── Node groups ── */
    const nGroups = svg.append("g").selectAll("g").data(N).join("g")
      .style("cursor", "pointer");

    const nRects = nGroups.append("rect")
      .attr("x",      d => d.x0)
      .attr("y",      d => d.y0)
      .attr("width",  d => d.x1 - d.x0)
      .attr("height", d => Math.max(4, d.y1 - d.y0))
      .attr("fill",   d => COLORS[d.index % COLORS.length])
      .attr("rx",     3)
      .attr("opacity", 0.9);

    const nTexts = nGroups.append("text")
      .attr("x",           d => d.x0 > W / 2 ? d.x0 - 8 : d.x1 + 8)
      .attr("y",           d => (d.y0 + d.y1) / 2)
      .attr("dy",          "0.35em")
      .attr("text-anchor", d => d.x0 > W / 2 ? "end" : "start")
      .attr("font-size",   10)
      .attr("fill",        textColor)
      .attr("font-family", "var(--font-mono, monospace)")
      .style("pointer-events", "none")
      .text(d => {
        const lbl = d.name.length > 14 ? d.name.slice(0, 13) + "…" : d.name;
        return `${lbl} (${fmtV(d.value)})`;
      });

    /* ── Drag-mode ring + hint (rendered above nodes) ── */
    const dragRing = svg.append("rect")
      .attr("fill",             "none")
      .attr("stroke",           "#ff4757")
      .attr("stroke-width",     1.4)
      .attr("stroke-dasharray", "5 3.5")
      .attr("rx",               5)
      .attr("opacity",          0)
      .style("pointer-events",  "none");

    const dragHint = svg.append("text")
      .attr("opacity",      0)
      .attr("font-size",    8.5)
      .attr("fill",         "#ff4757")
      .attr("font-family",  "var(--font-mono, monospace)")
      .attr("text-anchor",  "middle")
      .style("pointer-events", "none")
      .text("✦ drag");

    /* ── Node hover & double-click ── */
    nGroups
      .on("mouseover", function(ev, d) {
        if (activeNode) return;
        const cL = L.filter(l => l.source === d || l.target === d);
        const cS = new Set(cL.flatMap(l => [l.source.index, l.target.index]));

        lPaths.attr("opacity", l => cL.includes(l) ? 0.96 : 0.09)
              .attr("stroke",   (l, i) => `url(#${cL.includes(l) ? "sgh" : "sg"}${i})`);
        nRects.attr("opacity", n => cS.has(n.index) ? 1   : 0.14)
              .attr("filter",  n => n === d ? "url(#sk-glow2)" : cS.has(n.index) ? "url(#sk-glow)" : "none");
        nTexts.attr("opacity", n => cS.has(n.index) ? 1 : 0.14);

        const col = COLORS[d.index % COLORS.length];
        const inL = L.filter(l => l.target === d);
        const outL = L.filter(l => l.source === d);

        const row = (label, val, color) =>
          `<div style="display:flex;justify-content:space-between;gap:16px;padding:1.5px 0">
            <span style="color:${mutedColor}">${label}</span>
            <span style="font-weight:600;color:${color || textColor}">${fmtV(val)}</span>
           </div>`;

        let body =
          `<div style="color:${col};font-size:12.5px;font-weight:800;margin-bottom:1px;letter-spacing:-.01em">${d.name}</div>
           <div style="color:${textColor};font-size:11px;margin-bottom:8px">Total: <strong>${fmtV(d.value)}</strong></div>`;
        if (inL.length) {
          body += `<div style="color:${mutedColor};font-size:8.5px;letter-spacing:.07em;text-transform:uppercase;margin-bottom:3px">INCOMING</div>`;
          body += inL.map(l => row(l.source.name, l.value, COLORS[l.source.index % COLORS.length])).join("");
        }
        if (outL.length) {
          body += `<div style="color:${mutedColor};font-size:8.5px;letter-spacing:.07em;text-transform:uppercase;margin-top:7px;margin-bottom:3px">OUTGOING</div>`;
          body += outL.map(l => row(l.target.name, l.value, COLORS[l.target.index % COLORS.length])).join("");
        }
        body += `<div style="margin-top:9px;border-top:1px solid rgba(255,71,87,0.14);padding-top:6px;color:${mutedColor};font-size:8.5px">double-click to drag</div>`;
        showTip(ev, body);
      })
      .on("mousemove", function(ev) { if (!activeNode) moveTip(ev); })
      .on("mouseout",  function()   { if (!activeNode) { resetAll(); hideTip(); } })
      .on("dblclick",  function(ev, d) {
        ev.stopPropagation();
        hideTip();
        if (activeNode === d) {
          activeNode = null;
          resetAll();
          syncDragRing(null);
        } else {
          activeNode = d;
          resetAll();
          nRects.filter(n => n === d)
            .attr("filter", "url(#sk-glow2)")
            .attr("stroke", "#ff4757")
            .attr("stroke-width", 1.5)
            .attr("stroke-opacity", 0.85);
          syncDragRing(d);
        }
      });

    /* ── SVG mousemove → move active node ── */
    svg.on("mousemove.drag", function(ev) {
      if (!activeNode) return;
      const [mx, my] = d3.pointer(ev);
      const nW = activeNode.x1 - activeNode.x0;
      const nH = activeNode.y1 - activeNode.y0;

      const prevY0 = activeNode.y0;
      const newX0  = Math.max(4, Math.min(W - nW - 4, mx - nW / 2));
      const newY0  = Math.max(4, Math.min(H - nH - 4, my - nH / 2));
      const dy     = newY0 - prevY0;

      activeNode.x0 = newX0; activeNode.x1 = newX0 + nW;
      activeNode.y0 = newY0; activeNode.y1 = newY0 + nH;

      L.forEach(l => {
        if (l.source === activeNode) l.y0 += dy;
        if (l.target === activeNode) l.y1 += dy;
      });

      updateDOM();
      syncDragRing(activeNode);
      svg.style("cursor", "grabbing");
    });

    svg.on("mouseleave.drag", function() {
      svg.style("cursor", null);
    });

    /* ── Keyboard: Escape to drop ── */
    const onKey = (ev) => {
      if (ev.key === "Escape" && activeNode) {
        activeNode = null; resetAll(); syncDragRing(null);
        svg.style("cursor", null);
      }
    };
    window.addEventListener("keydown", onKey);

    /* ── Entry animation: fade in links ── */
    lPaths.attr("opacity", 0)
      .transition().duration(600).delay((_, i) => i * 40)
      .attr("opacity", 0.74);

    nRects.attr("opacity", 0)
      .transition().duration(500).delay((_, i) => 200 + i * 30)
      .attr("opacity", 0.9);

    nTexts.attr("opacity", 0)
      .transition().duration(400).delay((_, i) => 350 + i * 30)
      .attr("opacity", 1);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [type, theme, getSankeyData, dark]);

  return (
    <div
      ref={ref}
      id="d3-sankey-container"
      style={{ width: "100%", position: "relative", userSelect: "none" }}
    />
  );
}

export default D3SankeyChart;
