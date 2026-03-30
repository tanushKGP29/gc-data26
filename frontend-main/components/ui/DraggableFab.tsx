// @ts-nocheck
import { useCallback, useState, useRef, useEffect } from "react";

function DraggableFAB({ chatOpen, onClick, posRef }) {
  const [pos, setPos] = useState({
    x: window.innerWidth - 80,
    y: window.innerHeight - 88,
  });
  const [dragging, setDragging] = useState(false);
  const [moved, setMoved] = useState(false);
  const dragStart = useRef(null);
  const onMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      dragStart.current = {
        mx: e.clientX,
        my: e.clientY,
        px: pos.x,
        py: pos.y,
      };
      setMoved(false);
      const onMove = (ev) => {
        const dx = ev.clientX - dragStart.current.mx,
          dy = ev.clientY - dragStart.current.my;
        if (Math.abs(dx) + Math.abs(dy) > 4) setMoved(true);
        setDragging(true);
        const newPos = {
          x: Math.max(
            10,
            Math.min(window.innerWidth - 62, dragStart.current.px + dx),
          ),
          y: Math.max(
            10,
            Math.min(window.innerHeight - 62, dragStart.current.py + dy),
          ),
        };
        setPos(newPos);
        if (posRef) posRef.current = newPos;
      };
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [pos, posRef],
  );
  return (
    <div
      className={`ai-fab${dragging ? " dragging" : ""}${chatOpen ? " chat-is-open" : ""}`}
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={onMouseDown}
      onClick={() => {
        if (!moved) onClick();
      }}
      title="Frammer AI Copilot — ask anything about the data"
    >
      <span className="ai-fab-icon">✦</span>
      <span className="ai-fab-pulse" />
    </div>
  );
}

export default DraggableFAB;