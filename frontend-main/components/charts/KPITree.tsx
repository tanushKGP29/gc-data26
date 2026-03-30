// @ts-nocheck
import * as d3 from 'd3';

import { useRef, useState, useEffect } from "react";

function KPITree({ data }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [tick, forceUpdate] = useState(0);
  const dragOffsets = useRef({});

  const dark = document.documentElement.getAttribute("data-theme") !== "light";
  const textColor = dark ? "#ffffff" : "#0e0f11";
  const mutedColor = dark ? "rgba(255,255,255,0.58)" : "rgba(14,15,17,0.58)";
  const lineColor = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.16)";

  const collapseState = useRef({});

  useEffect(() => {
    const svgEl = svgRef.current;
    const container = containerRef.current;
    if (!svgEl || !container) return;
    const W = Math.max(container.clientWidth || 700, 400);

    const nodeR = { root: 13, category: 10, group: 7, leaf: 5 };
    const catColors = ["#ff4757", "rgba(255,71,87,0.78)", "#ffffff", "rgba(255,255,255,0.68)", "#30b060"];

    // Build d3 hierarchy with collapse state
    let catIdx = 0;
    function buildHier(node) {
      const key = node.name;
      // default: expand categories, collapse groups
      if (!(key in collapseState.current)) {
        collapseState.current[key] = node.type === "group";
      }
      const collapsed = collapseState.current[key];
      const kids =
        node.children && !collapsed ? node.children.map(buildHier) : null;
      const color =
        node.type === "category"
          ? catColors[catIdx++ % catColors.length]
          : node.color || null;
      return {
        id: key,
        name: node.name,
        type: node.type || "leaf",
        color,
        critical: node.critical || false,
        value: node.value || null,
        avail: node.avail || null,
        formula: node.formula || null,
        hasKids: !!(node.children && node.children.length),
        collapsed,
        children: kids,
      };
    }
    catIdx = 0;
    const treeData = buildHier(data);

    const root = d3.hierarchy(treeData, (d) => d.children);

    const treeLayout = d3.tree().nodeSize([52, 190]);
    treeLayout(root);

    let x0 = Infinity,
      x1 = -Infinity;
    root.descendants().forEach((d) => {
      const off = dragOffsets.current[d.data.id] || { x: 0, y: 0 };
      if (d.x + off.x < x0) x0 = d.x + off.x;
      if (d.x + off.x > x1) x1 = d.x + off.x;
    });
    const PAD = 60,
      H = Math.max(x1 - x0 + PAD * 2 + 40, 180);

    d3.select(svgEl).selectAll("*").remove();
    d3.select(svgEl)
      .attr("width", W)
      .attr("height", H)
      .attr("viewBox", `0 0 ${W} ${H}`);

    const g = d3
      .select(svgEl)
      .append("g")
      .attr("transform", `translate(${PAD},${-x0 + PAD})`);

    const linkGen = d3
      .linkHorizontal()
      .x((d) => d.y)
      .y((d) => d.x);

    // Draw links
    g.selectAll(".kl")
      .data(root.links())
      .join("path")
      .attr("class", "kl")
      .attr("fill", "none")
      .attr("stroke", lineColor)
      .attr("stroke-width", (d) =>
        d.target.data.type === "category"
          ? 1.5
          : d.target.data.type === "group"
            ? 1.1
            : 0.75,
      )
      .attr("opacity", 0.65)
      .attr("d", (d) => {
        const so = dragOffsets.current[d.source.data.id] || {
          x: 0,
          y: 0,
        };
        const to = dragOffsets.current[d.target.data.id] || {
          x: 0,
          y: 0,
        };
        return linkGen({
          source: { x: d.source.x + so.x, y: d.source.y + so.y },
          target: { x: d.target.x + to.x, y: d.target.y + to.y },
        });
      });

    // Draw nodes
    const nodeG = g
      .selectAll(".kn")
      .data(root.descendants())
      .join("g")
      .attr("class", "kn")
      .attr("transform", (d) => {
        const off = dragOffsets.current[d.data.id] || { x: 0, y: 0 };
        return `translate(${d.y + off.y},${d.x + off.x})`;
      })
      .style("cursor", (d) => (d.data.hasKids ? "pointer" : "default"));

    // Critical ring
    nodeG
      .filter((d) => d.data.critical)
      .append("circle")
      .attr("r", (d) => (nodeR[d.data.type] || 5) + 5)
      .attr("fill", "none")
      .attr("stroke", "#ff4757")
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "3,2")
      .attr("opacity", 0.8);

    // Circle
    nodeG
      .append("circle")
      .attr("r", (d) => nodeR[d.data.type] || 5)
      .attr(
        "fill",
        (d) =>
          d.data.color ||
          (d.data.type === "root"
            ? "rgba(255,255,255,0.45)"
            : d.data.type === "group"
              ? "rgba(255,255,255,0.3)"
              : "rgba(255,71,87,0.26)"),
      )
      .attr("stroke", (d) =>
        d.data.type === "root" ? "rgba(255,255,255,0.25)" : "none",
      )
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.92);

    // +/- label
    nodeG
      .filter((d) => d.data.hasKids)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "10")
      .attr("font-weight", "700")
      .attr("fill", "#fff")
      .attr("pointer-events", "none")
      .text((d) => (d.data.collapsed ? "+" : "−"));

    // Name label
    nodeG
      .append("text")
      .attr("dy", "0.32em")
      .attr("x", (d) => (nodeR[d.data.type] || 5) + 8)
      .attr("font-size", (d) =>
        d.data.type === "root"
          ? 13
          : d.data.type === "category"
            ? 12
            : d.data.type === "group"
              ? 11
              : 10,
      )
      .attr("font-weight", (d) =>
        d.data.type === "root" || d.data.type === "category" ? "600" : "400",
      )
      .attr("font-family", "var(--font-mono)")
      .attr("fill", (d) =>
        d.data.critical
          ? "#ff4757"
          : d.data.type === "root"
            ? textColor
            : d.data.type === "category"
              ? textColor
              : mutedColor,
      )
      .attr("pointer-events", "none")
      .text((d) =>
        d.data.name.length > 30
          ? d.data.name.slice(0, 28) + "\u2026"
          : d.data.name,
      );

    // Value
    nodeG
      .filter((d) => d.data.value && d.data.type === "leaf")
      .append("text")
      .attr("x", 185)
      .attr("dy", "0.32em")
      .attr("font-size", "9")
      .attr("font-family", "var(--font-mono)")
      .attr("fill", (d) => (d.data.critical ? "#ff4757" : mutedColor))
      .attr("pointer-events", "none")
      .text((d) => d.data.value);

    // Avail pill
    nodeG
      .filter((d) => d.data.avail && d.data.type === "leaf")
      .each(function (d) {
        const pg = d3.select(this);
        const isDirect = d.data.avail === "direct";
        const px = 235;
        pg.append("rect")
          .attr("x", px)
          .attr("y", -8)
          .attr("width", isDirect ? 40 : 46)
          .attr("height", 16)
          .attr("rx", 3)
          .attr(
            "fill",
            isDirect ? "rgba(48,176,96,0.15)" : "rgba(212,149,42,0.12)",
          )
          .attr(
            "stroke",
            isDirect ? "rgba(48,176,96,0.3)" : "rgba(212,149,42,0.3)",
          );
        pg.append("text")
          .attr("x", px + 5)
          .attr("dy", "0.32em")
          .attr("font-size", "8.5")
          .attr("font-family", "var(--font-mono)")
          .attr("fill", isDirect ? "#50d080" : "#f0b84a")
          .attr("pointer-events", "none")
          .text(d.data.avail);
      });

    // Tooltip
    nodeG
      .on("mouseover", function (event, d) {
        const tip = document.getElementById("kpi-d3-tip");
        if (!tip) return;
        const ls = [d.data.name];
        if (d.data.formula) ls.push("Formula: " + d.data.formula);
        if (d.data.value) ls.push("Value: " + d.data.value);
        if (d.data.critical) ls.push("\u26a0 CRITICAL");
        if (d.data.avail) ls.push("Source: " + d.data.avail);
        tip.innerHTML = ls
          .map(
            (l, i) =>
              `<div style="${i === 0 ? "font-weight:600;margin-bottom:3px;color:var(--ink)" : "color:var(--ink3);font-size:9px"}">${l}</div>`,
          )
          .join("");
        tip.style.display = "block";
        tip.style.left =
          Math.min(event.clientX + 12, window.innerWidth - 280) + "px";
        tip.style.top =
          Math.min(event.clientY + 10, window.innerHeight - 130) + "px";
      })
      .on("mousemove", function (event) {
        const tip = document.getElementById("kpi-d3-tip");
        if (tip) {
          tip.style.left =
            Math.min(event.clientX + 12, window.innerWidth - 280) + "px";
          tip.style.top =
            Math.min(event.clientY + 10, window.innerHeight - 130) + "px";
        }
      })
      .on("mouseout", function () {
        const tip = document.getElementById("kpi-d3-tip");
        if (tip) tip.style.display = "none";
      });

    // Click to toggle collapse
    nodeG.on("click", function (event, d) {
      if (event.defaultPrevented) return;
      if (!d.data.hasKids) return;
      collapseState.current[d.data.id] = !d.data.collapsed;
      forceUpdate((n) => n + 1);
    });

    // Drag
    const drag = d3
      .drag()
      .on("start", function (event) {
        event.sourceEvent.stopPropagation();
      })
      .on("drag", function (event, d) {
        const off = dragOffsets.current[d.data.id] || { x: 0, y: 0 };
        dragOffsets.current[d.data.id] = {
          x: off.x + event.dy,
          y: off.y + event.dx,
        };
        const o = dragOffsets.current[d.data.id];
        d3.select(this).attr(
          "transform",
          `translate(${d.y + o.y},${d.x + o.x})`,
        );
        g.selectAll(".kl").attr("d", (ld) => {
          const so = dragOffsets.current[ld.source.data.id] || {
            x: 0,
            y: 0,
          };
          const to = dragOffsets.current[ld.target.data.id] || {
            x: 0,
            y: 0,
          };
          return linkGen({
            source: { x: ld.source.x + so.x, y: ld.source.y + so.y },
            target: { x: ld.target.x + to.x, y: ld.target.y + to.y },
          });
        });
      });
    nodeG.call(drag);
  }, [dark, data, tick]);

  useEffect(() => {
    const ob = new ResizeObserver(() => forceUpdate((n) => n + 1));
    if (containerRef.current) ob.observe(containerRef.current);
    return () => ob.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", minHeight: 200 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 8,
        }}
      >
        <button
          onClick={() => {
            dragOffsets.current = {};
            forceUpdate((n) => n + 1);
          }}
          style={{
            fontSize: 8,
            fontFamily: "var(--font-mono)",
            background: "var(--bg3)",
            border: "1px solid var(--line)",
            color: "var(--ink3)",
            borderRadius: 3,
            padding: "3px 9px",
            cursor: "pointer",
            letterSpacing: "0.1em",
          }}
        >
          ↺ Reset layout
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg
          ref={svgRef}
          style={{
            display: "block",
            fontFamily: "var(--font-mono)",
            overflow: "visible",
          }}
        />
      </div>
      <div
        id="kpi-d3-tip"
        className="kpi-tip"
        style={{
          display: "none",
          position: "fixed",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default KPITree;
