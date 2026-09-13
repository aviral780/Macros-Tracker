"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

type Insight = {
  primary: string[];
  secondary: string[];
  summary: string;
  cues: string[];
  alternatives: { name: string; why: string }[];
};

/**
 * Generated once per exercise and cached, so this costs one model call ever
 * rather than one per visit.
 */
export function ExerciseCoach({ exerciseId }: { exerciseId: number }) {
  const toast = useToast();
  const [data, setData] = useState<{ payload: Insight; model: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setData(await api<{ payload: Insight; model: string }>(`/api/insights/exercise/${exerciseId}`));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't load coaching notes", { tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <section className="panel flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-panel-2 text-train">
          <Icon name="spark" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold">Coaching notes</h2>
          <p className="text-[13px] text-muted">What this trains, how to do it well, and what to swap it for.</p>
        </div>
        <button className="btn btn-ghost btn-sm shrink-0" disabled={loading} onClick={load}>
          {loading ? "Reading…" : "Show"}
        </button>
      </section>
    );
  }

  const p = data.payload;
  return (
    <section className="panel overflow-hidden">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-bold">Coaching notes</h2>
        <p className="mt-0.5 text-[14px] text-ink-2">{p.summary}</p>
      </header>

      <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
        <Muscles label="Primary" names={p.primary} strong />
        <Muscles label="Also works" names={p.secondary} />
      </div>

      {p.cues.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <p className="field-label">Cues that change the outcome</p>
          <ul className="grid gap-1.5">
            {p.cues.map((c) => (
              <li key={c} className="flex gap-2 text-[14px] text-ink-2">
                <Icon name="check" size={15} className="mt-0.5 shrink-0 text-train" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.alternatives.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <p className="field-label">Swap it for</p>
          <ul className="grid gap-2">
            {p.alternatives.map((a) => (
              <li key={a.name} className="rounded-xl border border-line p-2.5">
                <span className="text-[14px] font-semibold">{a.name}</span>
                <p className="mt-0.5 text-[13px] text-ink-2">{a.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="px-4 py-2 text-[11px] text-muted">Written by {data.model}</p>
    </section>
  );
}

function Muscles({ label, names, strong }: { label: string; names: string[]; strong?: boolean }) {
  if (names.length === 0) return null;
  return (
    <div>
      <p className="field-label">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {names.map((n) => (
          <span
            key={n}
            className={`rounded-full border px-2 py-0.5 text-[13px] ${
              strong ? "border-train/40 font-semibold text-train" : "border-line text-ink-2"
            }`}
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}
