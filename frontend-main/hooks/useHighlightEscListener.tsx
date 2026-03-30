// @ts-nocheck
import { useEffect } from "react";

function HighlightEscListener({ onEscape }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape]);
  return null;
}

export default HighlightEscListener;
