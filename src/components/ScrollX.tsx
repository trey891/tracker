"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Horizontal-scroll wrapper for wide tables. The content pane hides its native
// scrollbar; a custom high-contrast thumb rides in a track that sticks to the
// bottom of the viewport, so it's visible and draggable on every platform
// (including iPad/iOS, which hide native scrollbars) even before you reach
// the bottom of the table.
export function ScrollX({ children, className }: { children: React.ReactNode; className?: string }) {
  const paneRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startSl: number } | null>(null);
  const [dims, setDims] = useState({ sw: 0, cw: 0, sl: 0 });

  const measure = useCallback(() => {
    const p = paneRef.current;
    if (!p) return;
    setDims({ sw: p.scrollWidth, cw: p.clientWidth, sl: p.scrollLeft });
  }, []);

  useEffect(() => {
    const p = paneRef.current;
    if (!p) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(p);
    if (p.firstElementChild) ro.observe(p.firstElementChild);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const maxScroll = dims.sw - dims.cw;
  const needsBar = maxScroll > 2;
  const thumbPct = needsBar ? Math.max(8, (dims.cw / dims.sw) * 100) : 100;
  const leftPct = needsBar && maxScroll > 0 ? (dims.sl / maxScroll) * (100 - thumbPct) : 0;

  function setScroll(sl: number) {
    const p = paneRef.current;
    if (p) p.scrollLeft = Math.max(0, Math.min(maxScroll, sl));
  }

  function thumbPx() {
    const track = trackRef.current;
    if (!track) return { trackW: 1, thumbW: 1 };
    const trackW = track.getBoundingClientRect().width;
    return { trackW, thumbW: (trackW * thumbPct) / 100 };
  }

  function onThumbPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startSl: paneRef.current?.scrollLeft ?? 0 };
  }
  function onThumbPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const { trackW, thumbW } = thumbPx();
    const usable = Math.max(1, trackW - thumbW);
    const dx = e.clientX - dragRef.current.startX;
    setScroll(dragRef.current.startSl + (dx / usable) * maxScroll);
  }
  function onThumbPointerUp() {
    dragRef.current = null;
  }

  // Click the track to jump.
  function onTrackPointerDown(e: React.PointerEvent) {
    if (e.target !== trackRef.current) return;
    const track = trackRef.current!;
    const r = track.getBoundingClientRect();
    const { thumbW } = thumbPx();
    const usable = Math.max(1, r.width - thumbW);
    const x = e.clientX - r.left - thumbW / 2;
    setScroll((x / usable) * maxScroll);
  }

  return (
    <div className={className}>
      <div ref={paneRef} onScroll={measure} className="scrollbar-hidden overflow-x-auto">
        {children}
      </div>
      {needsBar && (
        <div className="sticky bottom-0 z-20 rounded-b-2xl border-t border-line bg-panel px-2.5 py-2" aria-hidden>
          <div
            ref={trackRef}
            onPointerDown={onTrackPointerDown}
            className="relative h-3 cursor-pointer rounded-full bg-panel-2 ring-1 ring-line"
          >
            <div
              onPointerDown={onThumbPointerDown}
              onPointerMove={onThumbPointerMove}
              onPointerUp={onThumbPointerUp}
              className="absolute top-0 h-full cursor-grab rounded-full bg-brand shadow-[0_0_6px_rgba(124,92,255,0.6)] hover:bg-brand-soft active:cursor-grabbing"
              style={{ width: `${thumbPct}%`, left: `${leftPct}%`, touchAction: "none" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
