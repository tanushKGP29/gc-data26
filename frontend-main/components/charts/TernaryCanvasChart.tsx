// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from "react";
import Tooltip from "../ui/Tooltip";

function TernaryCanvasChart({
  dataset = "channels",
  topKey = "pub_rate",
  leftKey = "uploaded",
  rightKey = "created",
  dataMap = {},
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tip, setTip] = useState(null);
  const plottedRef = useRef([]);
  // transform state: { scale, tx, ty } — tx/ty are pan offsets in canvas px
  const xformRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const [xform, setXform] = useState({ scale: 1, tx: 0, ty: 0 });
  const dragRef = useRef(null); // { startX, startY, origTx, origTy }
  const isDraggingRef = useRef(false);

  const dark = document.documentElement.getAttribute("data-theme") !== "light";
  const COLORS_T = [
    "#ff4757",
    "#ffffff",
    "#30b060",
    "#ff4757",
    "#ffffff",
    "#30b060",
    "#ff4757",
    "#ffffff",
    "#30b060",
    "#ff4757",
    "#ffffff",
    "#30b060",
    "#ff4757",
    "#ffffff",
  ];

  const getPoints = useCallback(() => {
    return (dataMap[dataset] || []).map((item, i) => ({
      label:
        dataset === "users"
          ? item.label.split(" ")[0]
          : dataset === "inputtypes"
            ? item.label.slice(0, 8)
            : item.label,
      color: COLORS_T[i % COLORS_T.length],
      uploaded: item.uploaded,
      created: item.created,
      published: item.published,
      pub_rate: item.created
        ? +((item.published / item.created) * 100).toFixed(2)
        : 0,
      multiplier: item.uploaded
        ? +(item.created / item.uploaded).toFixed(2)
        : 0,
    }));
  }, [dataMap, dataset]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(canvas.offsetWidth || 0, 320);
    const H = 420;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const { scale, tx, ty } = xformRef.current;
    const textColor = dark ? "#ffffff" : "#0e0f11";
    const gridColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    const outerColor = dark ? "rgba(255,71,87,0.75)" : "rgba(255,71,87,0.65)";
    const points = getPoints();

    // Base triangle geometry — equilateral, centred
    const PAD = 70;
    const side = Math.min(W - PAD * 2, H - PAD * 1.5);
    const triH = (side * Math.sqrt(3)) / 2;
    const bCX = W / 2,
      bTY = (H - triH) / 2 + 10,
      bBY = bTY + triH;
    const bL = bCX - side / 2,
      bR = bCX + side / 2;

    // Vertices in base space
    const vT0 = { x: bCX, y: bTY },
      vL0 = { x: bL, y: bBY },
      vR0 = { x: bR, y: bBY };

    // Apply transform (scale around center, then translate)
    const cx = W / 2,
      cy = H / 2;
    const T = (x, y) => ({
      x: cx + (x - cx) * scale + tx,
      y: cy + (y - cy) * scale + ty,
    });

    const vT = T(vT0.x, vT0.y),
      vL = T(vL0.x, vL0.y),
      vR = T(vR0.x, vR0.y);

    // Ternary → cartesian (pre-transform)
    function ternToBase(a, b, c) {
      const s = a + b + c || 1,
        an = a / s,
        bn = b / s,
        cn = c / s;
      return {
        x: vL0.x * bn + vR0.x * cn + vT0.x * an,
        y: vL0.y * bn + vR0.y * cn + vT0.y * an,
      };
    }

    ctx.clearRect(0, 0, W, H);

    // ── Grid lines (10 divisions per axis, 3 families) ──
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.75;
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      // Family 1: parallel to LR baseline (constant top axis)
      const lp1 = T(vL0.x + (vT0.x - vL0.x) * t, vL0.y + (vT0.y - vL0.y) * t);
      const rp1 = T(vR0.x + (vT0.x - vR0.x) * t, vR0.y + (vT0.y - vR0.y) * t);
      ctx.beginPath();
      ctx.moveTo(lp1.x, lp1.y);
      ctx.lineTo(rp1.x, rp1.y);
      ctx.stroke();
      // Family 2: parallel to TL left edge (constant right axis)
      const tp2 = T(vT0.x + (vL0.x - vT0.x) * t, vT0.y + (vL0.y - vT0.y) * t);
      const rp2 = T(vR0.x + (vL0.x - vR0.x) * t, vR0.y + (vL0.y - vR0.y) * t);
      ctx.beginPath();
      ctx.moveTo(tp2.x, tp2.y);
      ctx.lineTo(rp2.x, rp2.y);
      ctx.stroke();
      // Family 3: parallel to TR right edge (constant left axis)
      const tp3 = T(vT0.x + (vR0.x - vT0.x) * t, vT0.y + (vR0.y - vT0.y) * t);
      const lp3 = T(vL0.x + (vR0.x - vL0.x) * t, vL0.y + (vR0.y - vL0.y) * t);
      ctx.beginPath();
      ctx.moveTo(tp3.x, tp3.y);
      ctx.lineTo(lp3.x, lp3.y);
      ctx.stroke();
    }

    // ── Outer triangle ──
    ctx.beginPath();
    ctx.moveTo(vT.x, vT.y);
    ctx.lineTo(vL.x, vL.y);
    ctx.lineTo(vR.x, vR.y);
    ctx.closePath();
    ctx.strokeStyle = outerColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Axis labels (outside vertices, always readable) ──
    ctx.font = `600 12px var(--font-mono)`;
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.fillText(topKey.replace(/_/g, " "), vT.x, Math.max(16, vT.y - 18));
    ctx.textAlign = "right";
    ctx.fillText(
      leftKey.replace(/_/g, " "),
      Math.max(10, vL.x - 12),
      vL.y + 18,
    );
    ctx.textAlign = "left";
    ctx.fillText(
      rightKey.replace(/_/g, " "),
      Math.min(W - 10, vR.x + 12),
      vR.y + 18,
    );

    // ── Plot points ──
    const r = Math.max(5, 5.5 * Math.min(2, scale));
    const plotted = [];
    points.forEach((p) => {
      const a = p[topKey] || 0,
        b = p[leftKey] || 0,
        c = p[rightKey] || 0;
      if (a === 0 && b === 0 && c === 0) return;
      const base = ternToBase(a, b, c);
      const pos = T(base.x, base.y);
      plotted.push({
        ...pos,
        label: p.label,
        color: p.color,
        detail: `${p.label}\n${topKey.replace(/_/g, " ")}: ${typeof a === "number" ? a.toFixed(2) : a}\n${leftKey.replace(/_/g, " ")}: ${b.toLocaleString()}\n${rightKey.replace(/_/g, " ")}: ${c.toLocaleString()}`,
      });
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + "cc";
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // ── Labels: simple offset, skip if near edge ──
    ctx.font = `10px var(--font-mono)`;
    ctx.fillStyle = textColor;
    plotted.forEach((p) => {
      const lx = Math.min(p.x + r + 4, W - 30);
      const ly = p.y + 4;
      ctx.textAlign = "left";
      ctx.fillText(p.label, lx, ly);
    });

    plottedRef.current = plotted;
  }, [dataset, topKey, leftKey, rightKey, dark, getPoints]); // xform NOT in deps — we read xformRef directly

  useEffect(() => {
    draw();
  }, [draw]);

  // Trigger redraw when transform changes (xform state change → redraw via separate effect)
  useEffect(() => {
    draw();
  }, [draw, xform]);

  // ── Wheel zoom toward cursor ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const prev = xformRef.current;
      const newScale = Math.max(0.4, Math.min(8, prev.scale * factor));
      const ratio = newScale / prev.scale;
      // Zoom toward cursor position
      const newTx = prev.tx - (mx - canvas.offsetWidth / 2) * (ratio - 1);
      const newTy = prev.ty - (my - canvas.offsetHeight / 2) * (ratio - 1);
      xformRef.current = { scale: newScale, tx: newTx, ty: newTy };
      setXform({ scale: newScale, tx: newTx, ty: newTy });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // ── Drag to pan ──
  const onMouseDown = useCallback((e) => {
    isDraggingRef.current = true;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origTx: xformRef.current.tx,
      origTy: xformRef.current.ty,
    };
    e.currentTarget.style.cursor = "grabbing";
  }, []);
  const onMouseMoveCanvas = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (isDraggingRef.current && dragRef.current) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newTx = dragRef.current.origTx + dx;
      const newTy = dragRef.current.origTy + dy;
      xformRef.current = { ...xformRef.current, tx: newTx, ty: newTy };
      setXform((x) => ({ ...x, tx: newTx, ty: newTy }));
      return;
    }
    // Tooltip hit test
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scaleX = canvas.width / (rect.width * dpr),
      scaleY = canvas.height / (rect.height * dpr);
    const mx = e.clientX - rect.left,
      my = e.clientY - rect.top;
    const hitR = Math.max(12, 9 * Math.min(2, xformRef.current.scale));
    const hit = plottedRef.current.find(
      (p) => Math.hypot(p.x - mx, p.y - my) < hitR,
    );
    setTip(hit ? { x: e.clientX, y: e.clientY, txt: hit.detail } : null);
  }, []);
  const onMouseUp = useCallback((e) => {
    isDraggingRef.current = false;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  }, []);

  const resetView = () => {
    xformRef.current = { scale: 1, tx: 0, ty: 0 };
    setXform({ scale: 1, tx: 0, ty: 0 });
  };

  // Redraw on container resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ob = new ResizeObserver(() => {
      draw();
    });
    ob.observe(canvas);
    return () => ob.disconnect();
  }, [draw]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          cursor: "grab",
          display: "block",
          borderRadius: "var(--radius)",
          minHeight: 380,
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMoveCanvas}
        onMouseUp={onMouseUp}
        onDoubleClick={resetView}
        onMouseLeave={(e) => {
          isDraggingRef.current = false;
          setTip(null);
          if (canvasRef.current) canvasRef.current.style.cursor = "grab";
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          display: "flex",
          gap: 5,
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            color: "var(--ink4)",
            marginRight: 2,
          }}
        >
          {xform.scale > 1.05 ? `${xform.scale.toFixed(1)}×` : ""}
        </span>
        {[
          [
            "+",
            () => {
              const p = xformRef.current;
              const ns = Math.min(8, p.scale * 1.4);
              xformRef.current = { ...p, scale: ns };
              setXform({ ...p, scale: ns });
            },
          ],
          [
            "−",
            () => {
              const p = xformRef.current;
              const ns = Math.max(0.4, p.scale * 0.71);
              xformRef.current = { ...p, scale: ns };
              setXform({ ...p, scale: ns });
            },
          ],
        ].map(([lbl, fn]) => (
          <button
            key={lbl}
            onClick={fn}
            style={{
              fontSize: 14,
              background: "var(--bg3)",
              border: "1px solid var(--line)",
              color: "var(--ink3)",
              borderRadius: 3,
              width: 26,
              height: 26,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {lbl}
          </button>
        ))}
        {(xform.scale !== 1 || xform.tx !== 0 || xform.ty !== 0) && (
          <button
            onClick={resetView}
            style={{
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              background: "var(--bg3)",
              border: "1px solid var(--line)",
              color: "var(--gold)",
              borderRadius: 3,
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        )}
      </div>
      <div
        style={{
          fontSize: 8,
          fontFamily: "var(--font-mono)",
          color: "var(--ink4)",
          marginTop: 6,
          paddingLeft: 2,
        }}
      >
        Drag to pan · Scroll to zoom · Double-click to reset view
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

export default TernaryCanvasChart;
