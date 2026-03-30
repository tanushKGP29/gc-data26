// @ts-nocheck
import { useRef, useState, useEffect } from "react";

function GraphFlip({ flipped, front, back, minHeight = 240 }) {
  const frontRef = useRef(null);
  const backRef  = useRef(null);
  const [frontH, setFrontH] = useState(minHeight);
  const [backH,  setBackH]  = useState(minHeight);

  useEffect(() => {
    const measureFront = () => setFrontH(frontRef.current?.scrollHeight ?? 0);
    const measureBack  = () => setBackH(backRef.current?.scrollHeight   ?? 0);
    measureFront();
    measureBack();
    const obs = new ResizeObserver(() => { measureFront(); measureBack(); });
    if (frontRef.current) obs.observe(frontRef.current);
    if (backRef.current)  obs.observe(backRef.current);
    return () => obs.disconnect();
  }, [minHeight, front, back]);

  const h = Math.max(minHeight, flipped ? backH : frontH);

  return (
    <div className="graph-flip" style={{ height: h }}>
      <div className={`graph-flip-inner${flipped ? " flipped" : ""}`}>
        <div className="graph-flip-face graph-flip-front" ref={frontRef}>{front}</div>
        <div className="graph-flip-face graph-flip-back"  ref={backRef}>{back}</div>
      </div>
    </div>
  );
}

export default GraphFlip;
