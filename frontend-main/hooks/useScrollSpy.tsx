// @ts-nocheck
import { useState, useEffect } from "react";

function useScrollSpy(sectionIds, contentRef, clientOpen, enabled = true) {
  const [activeId, setActiveId] = useState(sectionIds[0]);
  useEffect(() => {
    if (!enabled) return;
    if (clientOpen) return; // don't update scroll-spy when client panel is open
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => {
      let found = sectionIds[0];
      for (const id of sectionIds) {
        const sec = el.querySelector(`[data-section="${id}"]`);
        if (sec) {
          const rect = sec.getBoundingClientRect(),
            cr = el.getBoundingClientRect();
          if (rect.top - cr.top < cr.height * 0.4) found = id;
        }
      }
      setActiveId(found);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [sectionIds, contentRef, clientOpen, enabled]);
  return [activeId, setActiveId];
}

export default useScrollSpy;
