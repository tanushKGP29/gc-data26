// @ts-nocheck
import Tooltip from '@/components/ui/Tooltip';

import { useState } from "react";

function HeatCalendar({ data }) {
  const [tip, setTip] = useState(null);
  const maxV = Math.max(...data.map((d) => d.created));
  const cols = [
    "rgba(255,255,255,0.04)",
    "rgba(255,71,87,0.16)",
    "rgba(255,71,87,0.28)",
    "rgba(255,71,87,0.45)",
    "#ff4757",
    "#ffffff",
  ];
  const getCol = (v) => {
    const p = v / maxV;
    if (p > 0.8) return cols[5];
    if (p > 0.6) return cols[4];
    if (p > 0.4) return cols[3];
    if (p > 0.2) return cols[2];
    if (p > 0.05) return cols[1];
    return cols[0];
  };
  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        width: "100%",
        position: "relative",
      }}
    >
      {data.map((d, i) => (
        <div
          key={i}
          onMouseEnter={(e) =>
            setTip({
              x: e.clientX,
              y: e.clientY,
              txt: `${d.month}\nCreated: ${d.created.toLocaleString()}\nPublished: ${d.published}\nUploaded: ${d.uploaded}`,
            })
          }
          onMouseLeave={() => setTip(null)}
          style={{
            flex: 1,
            height: 40,
            background: getCol(d.created),
            margin: 1,
            borderRadius: 2,
            cursor: "pointer",
            transition: "transform .1s",
            border: "1px solid rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 2,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "scaleY(1.1)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "none";
          }}
        >
          <span
            style={{
              fontSize: 7,
              fontFamily: "var(--font-mono)",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            {d.month.split("'")[0]}
          </span>
        </div>
      ))}
      <Tooltip tip={tip} />
    </div>
  );
}

export default HeatCalendar;
