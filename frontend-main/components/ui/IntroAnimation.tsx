// @ts-nocheck
import { useState, useEffect } from "react";

const INTRO_KEY = "frammer_intro_shown_v1";
const FRAMMER_WORD = "FRAMMER AI";

function IntroAnimation({ onDone }) {
  const [charCount, setCharCount] = useState(0);
  const [cursorH, setCursorH] = useState(0);
  const [tag1, setTag1] = useState(false);
  const [tag2, setTag2] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [gone, setGone] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timers = [];
    const S = (fn, ms) => {
      const id = setTimeout(fn, ms);
      timers.push(id);
    };

    // 0 → 200ms: cursor bar grows from 0 to full height
    let h = 0;
    const grow = setInterval(() => {
      h = Math.min(h + 9, 88);
      setCursorH(h);
      if (h >= 88) clearInterval(grow);
    }, 16);
    timers.push(grow);

    // 320ms: start typing — 10 chars × 68ms ≈ 680ms
    S(() => {
      let ci = 0;
      const tick = setInterval(() => {
        ci++;
        setCharCount(ci);
        setProgress(Math.round((ci / FRAMMER_WORD.length) * 55));
        if (ci >= FRAMMER_WORD.length) {
          clearInterval(tick);
          S(() => {
            setTag1(true);
            setProgress(68);
          }, 220);
          S(() => {
            setTag2(true);
            setProgress(84);
          }, 500);
          S(() => {
            setProgress(100);
          }, 760);
          S(() => {
            setExiting(true);
          }, 1020);
          S(() => {
            setGone(true);
            onDone();
          }, 1700);
        }
      }, 68);
      timers.push(tick);
    }, 320);

    return () =>
      timers.forEach((id) => {
        clearTimeout(id);
        clearInterval(id);
      });
  }, []);

  if (gone) return null;

  const cursorPx = `${cursorH}px`;
  const FONT_H = "clamp(52px, 8vw, 88px)";

  return (
    <div className={`intro-overlay${exiting ? " exiting" : ""}`}>
      <div className="intro-stage">
        <div className="intro-wordmark" style={{ fontSize: FONT_H }}>
          {FRAMMER_WORD.slice(0, charCount)}
          <span
            style={{
              display: "inline-block",
              width: 4,
              height: cursorPx,
              background: "#ff4757",
              borderRadius: 2,
              marginLeft: charCount > 0 ? 5 : 0,
              verticalAlign: "middle",
              flexShrink: 0,
              boxShadow:
                "0 0 16px rgba(255,71,87,0.9),0 0 40px rgba(255,71,87,0.45)",
              transition: "height 0.04s linear",
            }}
          />
        </div>
        <div className="intro-tagline">
          <span className={`intro-tag-part${tag1 ? " visible" : ""}`}>
            Shorter Video.
          </span>
          <span className={`intro-tag-sep${tag2 ? " visible" : ""}`}>
            &nbsp;&nbsp;
          </span>
          <span
            className={`intro-tag-part${tag2 ? " visible" : ""}`}
            style={{ transitionDelay: tag2 ? "0.04s" : "0s" }}
          >
            Smarter Video.
          </span>
        </div>
      </div>
      <div className="intro-progress">
        <div
          className="intro-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default IntroAnimation;
