"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { authenticate } from "./actions";
import { Logo } from "@/components/Logo";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [error, formAction] = useActionState(authenticate, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <Logo />
          <div>
            <div className="text-lg font-semibold text-white">Pulse</div>
            <div className="text-[11px] uppercase tracking-widest text-slate-400">Status Hub</div>
          </div>
        </div>

        <div className="card card-pad">
          <h1 className="text-lg font-semibold text-white">Sign in</h1>
          <p className="mt-1 text-sm text-slate-400">Access the project tracker.</p>

          <form action={formAction} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@company.com" />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input id="password" name="password" type="password" required autoComplete="current-password" className="input" placeholder="••••••••" />
            </div>

            {error && (
              <p className="rounded-lg bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked ring-1 ring-status-blocked/30">
                {error}
              </p>
            )}

            <SubmitButton />
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Seeded team accounts share a default password — set in your environment. Change it after first login.
        </p>
      </div>
    </div>
  );
}
