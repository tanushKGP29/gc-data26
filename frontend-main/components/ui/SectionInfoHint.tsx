// @ts-nocheck
"use client";

export default function SectionInfoHint({ text }: { text?: string }) {
  const t = (text || "").trim();
  if (!t) return null;
  return (
    <span className="sec-info-wrap">
      <button
        type="button"
        className="sec-info-btn"
        aria-label={`About this section: ${t}`}
      >
        i
      </button>
      <span className="sec-info-tip">{t}</span>
    </span>
  );
}
