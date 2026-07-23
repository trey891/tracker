"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Renders the on-screen control bar (hidden when printing) and auto-opens the
// print dialog once images have loaded.
export function PrintTrigger() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      if (document.readyState === "complete") window.print();
    }, 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
      <button onClick={() => router.back()} className="text-sm text-gray-600 hover:text-gray-900">
        ← Back
      </button>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-gray-500 sm:inline">Use your browser&rsquo;s “Save as PDF”. Letter (8.5×11), white background.</span>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
