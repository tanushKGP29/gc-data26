// @ts-nocheck
import { useRef, useEffect } from "react";

function D3CollapsibleTree({
  rootDim = "channel",
  childDim = "user",
  metric = "cr",
  theme,
  data,
}) {
  const ref = useRef(null);
  const dark = theme !== "light";
  const COLORS16 = [
    "#ff4757",
    "#1D9E75",
    "#ffffff",
    "rgba(255,71,87,0.78)",
    "rgba(255,255,255,0.78)",
    "rgba(255,71,87,0.62)",
    "rgba(255,255,255,0.62)",
    "#3EC98A",
    "#0F6E56",
    "rgba(255,71,87,0.48)",
    "rgba(255,255,255,0.48)",
    "rgba(255,71,87,0.34)",
    "rgba(62,201,138,0.72)",
    "rgba(255,255,255,0.34)",
    "rgba(255,71,87,0.22)",
    "rgba(255,255,255,0.22)",
  ];

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = "";
    const W = container.clientWidth || 700;
    const textColor = dark ? "#ffffff" : "#0e0f11";
    const mutedColor = dark ? "rgba(255,255,255,0.58)" : "rgba(14,15,17,0.58)";
    const lineColor = dark ? "rgba(200,200,200,0.18)" : "rgba(0,0,0,0.15)";

    const channelRows = data?.channelMetrics || [];
    const inputTypes = data?.inputTypes || [];
    const languages = data?.languages || [];
    const users = data?.users || [];

    let rootNodes = [];
    if (rootDim === "channel")
      rootNodes = channelRows.map((row) => ({
        id: "ch_" + row.label,
        label: "Ch-" + row.label,
        value:
          metric === "cr"
            ? row.created
            : metric === "up"
              ? row.uploaded
              : row.published,
      }));
    else if (rootDim === "inputtype")
      rootNodes = inputTypes.map((t, i) => ({
        id: "it_" + i,
        label: t.type.slice(0, 12),
        value:
          metric === "cr"
            ? t.created
            : metric === "up"
              ? t.uploaded
              : t.published,
      }));
    else
      rootNodes = languages.map((l, i) => ({
        id: "lang_" + i,
        label: l.lang,
        value:
          metric === "cr"
            ? l.created
            : metric === "up"
              ? l.uploaded
              : l.published,
      }));

    function getChildren(rootNode) {
      if (childDim === "user")
        return users.map((u) => ({
          id: rootNode.id + "_u_" + u.user,
          label: u.user.split(" ")[0],
          value:
            metric === "cr"
              ? u.created
              : metric === "up"
                ? u.uploaded
                : u.published,
          leaf: true,
        }))
          .filter((c) => c.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);
      if (childDim === "channel")
        return channelRows.map((row) => ({
          id: rootNode.id + "_ch_" + row.label,
          label: "Ch-" + row.label,
          value:
            metric === "cr"
              ? row.created
              : metric === "up"
                ? row.uploaded
                : row.published,
          leaf: true,
        }))
          .filter((c) => c.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      return inputTypes.map((t, i) => ({
        id: rootNode.id + "_it_" + i,
        label: t.type.slice(0, 10),
        value:
          metric === "cr"
            ? t.created
            : metric === "up"
              ? t.uploaded
              : t.published,
        leaf: true,
      }))
        .filter((c) => c.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
    }

    const treeData = {
      id: "root",
      label: "All",
      value: rootNodes.reduce((s, r) => s + r.value, 0),
      children: rootNodes.map((r) => ({
        ...r,
        children: null,
        expanded: false,
        childData: getChildren(r),
      })),
    };
    const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgEl.setAttribute("width", "100%");
    container.appendChild(svgEl);

    // Color palette per root node index
    const rootColors = COLORS16;

    function render() {
      svgEl.innerHTML = "";
      const ROW_H = 38,
        PAD_L = 18,
        PAD_T = 16;
      const BAR_X = 270,
        BAR_W = Math.max(60, W - BAR_X - 16);

      // Build flat row list
      let rows = [];
      rows.push({ depth: 0, node: treeData, isRoot: true, colorIdx: 0 });
      treeData.children.forEach((child, ci) => {
        rows.push({ depth: 1, node: child, isRoot: false, colorIdx: ci });
        if (child.expanded && child.childData) {
          child.childData.forEach((gc, gi) =>
            rows.push({
              depth: 2,
              node: gc,
              isRoot: false,
              colorIdx: ci,
            }),
          );
        }
      });

      const H = PAD_T * 2 + rows.length * ROW_H + 8;
      svgEl.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svgEl.setAttribute("height", H);

      const maxAny = Math.max(
        1,
        ...rows.filter((r) => r.depth > 0).map((r) => r.node.value),
      );

      rows.forEach((row, ri) => {
        const y = PAD_T + ri * ROW_H;
        const { depth, node, isRoot, colorIdx } = row;
        const cy = y + ROW_H / 2;
        const xBase = PAD_L + depth * 28;
        const nodeColor = rootColors[colorIdx % rootColors.length];

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("data-rowid", ri);

        // Alternating row bg for depth 2
        if (depth === 2) {
          const bg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
          );
          bg.setAttribute("x", String(PAD_L + 20));
          bg.setAttribute("y", String(y + 2));
          bg.setAttribute("width", String(W - PAD_L - 24));
          bg.setAttribute("height", String(ROW_H - 4));
          bg.setAttribute("rx", "3");
          bg.setAttribute(
            "fill",
            dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
          );
          g.appendChild(bg);
        }

        // Connector lines
        if (!isRoot) {
          // vertical line from parent's node x down to this row
          const parentXBase = PAD_L + (depth - 1) * 28;
          const vl = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line",
          );
          vl.setAttribute("x1", String(parentXBase + 9));
          vl.setAttribute("y1", String(y));
          vl.setAttribute("x2", String(parentXBase + 9));
          vl.setAttribute("y2", String(cy));
          vl.setAttribute("stroke", lineColor);
          vl.setAttribute("stroke-width", "1.2");
          vl.setAttribute("stroke-linecap", "round");
          g.appendChild(vl);
          const hl = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line",
          );
          hl.setAttribute("x1", String(parentXBase + 9));
          hl.setAttribute("y1", String(cy));
          hl.setAttribute("x2", String(xBase));
          hl.setAttribute("y2", String(cy));
          hl.setAttribute("stroke", lineColor);
          hl.setAttribute("stroke-width", "1.2");
          hl.setAttribute("stroke-linecap", "round");
          g.appendChild(hl);
        }

        if (isRoot) {
          // Root: just a diamond marker
          const dia = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
          );
          dia.setAttribute("x", String(xBase - 5));
          dia.setAttribute("y", String(cy - 5));
          dia.setAttribute("width", "10");
          dia.setAttribute("height", "10");
          dia.setAttribute("rx", "2");
          dia.setAttribute("transform", `rotate(45,${xBase},${cy})`);
          dia.setAttribute("fill", "var(--gold)");
          g.appendChild(dia);
          const lbl = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
          );
          lbl.setAttribute("x", String(xBase + 16));
          lbl.setAttribute("y", String(cy + 1));
          lbl.setAttribute("dominant-baseline", "central");
          lbl.setAttribute("font-size", "13");
          lbl.setAttribute("font-weight", "600");
          lbl.setAttribute("fill", textColor);
          lbl.setAttribute("font-family", "var(--font-mono)");
          lbl.textContent =
            node.label + " (" + node.value.toLocaleString() + ")";
          g.appendChild(lbl);
        } else if (depth === 1) {
          // Level 1: colored circle with +/−
          const circ = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle",
          );
          circ.setAttribute("cx", String(xBase));
          circ.setAttribute("cy", String(cy));
          circ.setAttribute("r", "10");
          circ.setAttribute("fill", nodeColor);
          circ.setAttribute("opacity", "0.92");
          circ.style.cursor = "pointer";
          const sign = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
          );
          sign.setAttribute("x", String(xBase));
          sign.setAttribute("y", String(cy + 1));
          sign.setAttribute("text-anchor", "middle");
          sign.setAttribute("dominant-baseline", "central");
          sign.setAttribute("font-size", "12");
          sign.setAttribute("fill", "#fff");
          sign.setAttribute("font-weight", "700");
          sign.style.cursor = "pointer";
          sign.textContent = node.expanded ? "−" : "+";
          const clickFn = () => {
            node.expanded = !node.expanded;
            render();
          };
          circ.addEventListener("click", clickFn);
          sign.addEventListener("click", clickFn);
          g.appendChild(circ);
          g.appendChild(sign);

          const lbl = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
          );
          lbl.setAttribute("x", String(xBase + 16));
          lbl.setAttribute("y", String(cy + 1));
          lbl.setAttribute("dominant-baseline", "central");
          lbl.setAttribute("font-size", "12");
          lbl.setAttribute("font-weight", "500");
          lbl.setAttribute("fill", textColor);
          lbl.setAttribute("font-family", "var(--font-mono)");
          const lbTxt =
            node.label.length > 18 ? node.label.slice(0, 16) + "…" : node.label;
          lbl.textContent = lbTxt;
          g.appendChild(lbl);

          // Value number
          const val = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
          );
          val.setAttribute("x", String(BAR_X - 8));
          val.setAttribute("y", String(cy + 1));
          val.setAttribute("text-anchor", "end");
          val.setAttribute("dominant-baseline", "central");
          val.setAttribute("font-size", "11");
          val.setAttribute("fill", mutedColor);
          val.setAttribute("font-family", "var(--font-mono)");
          val.textContent = node.value.toLocaleString();
          g.appendChild(val);

          // Progress bar
          const barBg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
          );
          barBg.setAttribute("x", String(BAR_X));
          barBg.setAttribute("y", String(cy - 5));
          barBg.setAttribute("width", String(BAR_W));
          barBg.setAttribute("height", "10");
          barBg.setAttribute("rx", "3");
          barBg.setAttribute(
            "fill",
            dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
          );
          g.appendChild(barBg);
          const bw = Math.max(2, Math.round((node.value / maxAny) * BAR_W));
          const bar = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
          );
          bar.setAttribute("x", String(BAR_X));
          bar.setAttribute("y", String(cy - 5));
          bar.setAttribute("width", String(bw));
          bar.setAttribute("height", "10");
          bar.setAttribute("rx", "3");
          bar.setAttribute("fill", nodeColor + "aa");
          g.appendChild(bar);
        } else {
          // Depth 2: leaf dot
          const dot = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle",
          );
          dot.setAttribute("cx", String(xBase));
          dot.setAttribute("cy", String(cy));
          dot.setAttribute("r", "4");
          dot.setAttribute("fill", nodeColor + "cc");
          g.appendChild(dot);

          const lbl = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
          );
          lbl.setAttribute("x", String(xBase + 10));
          lbl.setAttribute("y", String(cy + 1));
          lbl.setAttribute("dominant-baseline", "central");
          lbl.setAttribute("font-size", "11");
          lbl.setAttribute("font-weight", "400");
          lbl.setAttribute("fill", mutedColor);
          lbl.setAttribute("font-family", "var(--font-mono)");
          const lbTxt2 =
            node.label.length > 20 ? node.label.slice(0, 18) + "…" : node.label;
          lbl.textContent = lbTxt2;
          g.appendChild(lbl);

          const val = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
          );
          val.setAttribute("x", String(BAR_X - 8));
          val.setAttribute("y", String(cy + 1));
          val.setAttribute("text-anchor", "end");
          val.setAttribute("dominant-baseline", "central");
          val.setAttribute("font-size", "10");
          val.setAttribute("fill", mutedColor);
          val.setAttribute("font-family", "var(--font-mono)");
          val.textContent = node.value.toLocaleString();
          g.appendChild(val);

          const barBg2 = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
          );
          barBg2.setAttribute("x", String(BAR_X));
          barBg2.setAttribute("y", String(cy - 4));
          barBg2.setAttribute("width", String(BAR_W));
          barBg2.setAttribute("height", "8");
          barBg2.setAttribute("rx", "2");
          barBg2.setAttribute(
            "fill",
            dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
          );
          g.appendChild(barBg2);
          const bw2 = Math.max(2, Math.round((node.value / maxAny) * BAR_W));
          const bar2 = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect",
          );
          bar2.setAttribute("x", String(BAR_X));
          bar2.setAttribute("y", String(cy - 4));
          bar2.setAttribute("width", String(bw2));
          bar2.setAttribute("height", "8");
          bar2.setAttribute("rx", "2");
          bar2.setAttribute("fill", nodeColor + "77");
          g.appendChild(bar2);
        }

        svgEl.appendChild(g);
      });
    }
    render();
  }, [rootDim, childDim, data, metric, theme, dark]);

  return (
    <div
      ref={ref}
      id="d3-tree-container"
      style={{ width: "100%", overflowX: "auto" }}
    />
  );
}

export default D3CollapsibleTree;
