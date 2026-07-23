"use client";

import { useEffect, useRef, useState } from "react";

// Horizontal-scroll wrapper for wide tables. The content pane hides its native
// scrollbar; a slim synced scrollbar sticks to the bottom of the viewport so
// it's reachable even when you're not at the bottom of the table.
export function ScrollX({ children, className }: { children: React.ReactNode; className?: string }) {
  const paneRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [clientWidth, setClientWidth] = useState(0);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const measure = () => {
      setScrollWidth(pane.scrollWidth);
      setClientWidth(pane.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pane);
    if (pane.firstElementChild) ro.observe(pane.firstElementChild);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const syncFromPane = () => {
    const p = paneRef.current;
    const b = barRef.current;
    if (p && b && b.scrollLeft !== p.scrollLeft) b.scrollLeft = p.scrollLeft;
  };
  const syncFromBar = () => {
    const p = paneRef.current;
    const b = barRef.current;
    if (p && b && p.scrollLeft !== b.scrollLeft) p.scrollLeft = b.scrollLeft;
  };

  const needsBar = scrollWidth > clientWidth + 2;

  return (
    <div className={className}>
      <div ref={paneRef} onScroll={syncFromPane} className="scrollbar-hidden overflow-x-auto">
        {children}
      </div>
      {needsBar && (
        <div
          ref={barRef}
          onScroll={syncFromBar}
          className="sticky bottom-0 z-20 overflow-x-auto overflow-y-hidden rounded-b-2xl bg-panel/90"
          style={{ height: 14 }}
          aria-hidden
        >
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>
      )}
    </div>
  );
}
