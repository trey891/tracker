"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { publishWeeklySnapshot } from "@/app/(app)/dashboard/actions";
import { PublishPdfButton } from "./PublishPdfButton";

export function DashboardActions({ canEdit = true }: { canEdit?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");

  async function publish() {
    setState("saving");
    try {
      await publishWeeklySnapshot();
      setState("done");
      router.refresh();
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("idle");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <PublishPdfButton />
      <a href="/api/export/xlsx" className="btn-ghost">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        Export
      </a>
      {canEdit && (
        <button onClick={publish} disabled={state === "saving"} className="btn-ghost">
          {state === "done" ? "Published ✓" : state === "saving" ? "Publishing…" : "Publish snapshot"}
        </button>
      )}
      {canEdit && (
        <Link href="/tasks?new=1" className="btn-primary">
          + New Task
        </Link>
      )}
    </div>
  );
}
