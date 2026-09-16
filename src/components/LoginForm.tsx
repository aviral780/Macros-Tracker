"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Couldn't sign in");
      }
      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-sm place-content-center">
      <form onSubmit={submit} className="panel w-full p-6">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink text-panel">
          <Icon name="today" size={22} />
        </span>
        <h1 className="condensed mt-4 text-[30px] font-black leading-tight">Macros</h1>
        <p className="mt-1 text-[14px] text-ink-2">Enter your password to open your log.</p>

        <label className="mt-5 block">
          <span className="field-label">Password</span>
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-critical">
            <Icon name="alert" size={15} />
            {error}
          </p>
        )}

        <button className="btn btn-primary mt-4 w-full" disabled={busy || !password}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
