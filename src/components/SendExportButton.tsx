"use client";

import { useActionState } from "react";
import { sendExportNow, type SendState } from "@/app/(app)/settings/actions";

export function SendExportButton({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState<SendState, FormData>(sendExportNow, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send archive now"}
      </button>
      {!configured && <span className="text-xs text-amber-400">Email not configured — this will report what to set.</span>}
      {state && (
        <span className={`text-sm ${state.ok ? "text-emerald-400" : "text-rose-400"}`}>{state.message}</span>
      )}
    </form>
  );
}
