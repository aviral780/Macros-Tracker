"use client";

import Link from "next/link";
import { useState } from "react";
import { api, useData } from "@/lib/client";
import { Icon } from "./Icon";

type Snapshot = {
  nextDay: string;
  trainedToday: boolean;
  streak: number;
  weekWorkouts: number;
  weekTarget: number;
  weekCardio: number;
  cardioTarget: number;
};
type Nudge = {
  kind: "train" | "cardio" | "log" | "done";
  urgency: "normal" | "high";
  title: string;
  body: string;
  snapshot: Snapshot;
};
type Pep = { pep: { lines: string[] } };

const ACTION: Record<Nudge["kind"], { label: string; href: string } | null> = {
  train: { label: "Start the session", href: "/train" },
  cardio: { label: "Log cardio", href: "/train" },
  log: { label: "Log food", href: "/log" },
  done: null,
};

export function MomentumCard() {
  const { data } = useData<Nudge>("/api/nudge");
  const [pep, setPep] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  if (!data) return null;
  const s = data.snapshot;
  const action = ACTION[data.kind];
  const high = data.urgency === "high";

  const showPep = async () => {
    setLoading(true);
    try {
      const r = await api<Pep>("/api/nudge?pep=1");
      setPep(r.pep.lines);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={`panel overflow-hidden ${high ? "border-line-strong" : ""}`}>
      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg"
          style={{ background: high ? "var(--train)" : "var(--train-track)", color: high ? "var(--panel)" : "var(--train)" }}
        >
          <Icon name={data.kind === "done" ? "trophy" : data.kind === "log" ? "camera" : "dumbbell"} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="semi-condensed text-[19px] font-bold leading-tight">{data.title}</h2>
          <p className="mt-0.5 text-[14px] text-ink-2">{data.body}</p>
        </div>
      </div>

      <dl className="grid grid-cols-3 border-y border-line text-center">
        {[
          ["Streak", s.streak > 0 ? `${s.streak}d` : "—"],
          ["Training", `${s.weekWorkouts}/${s.weekTarget}`],
          ["Cardio", `${s.weekCardio}/${s.cardioTarget}`],
        ].map(([k, v]) => (
          <div key={k} className="border-r border-line py-2.5 last:border-r-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
            <dd className="text-[17px] font-bold tnum">{v}</dd>
          </div>
        ))}
      </dl>

      {pep ? (
        <ul className="px-4 py-3">
          {pep.map((line) => (
            <li key={line} className="flex gap-2 py-1 text-[14px] text-ink-2">
              <Icon name="check" size={15} className="mt-0.5 shrink-0 text-train" />
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3">
          {action && (
            <Link href={action.href} className="btn btn-primary btn-sm flex-1">
              {action.label}
            </Link>
          )}
          <button className="btn btn-ghost btn-sm flex-1" disabled={loading} onClick={showPep}>
            Not feeling it
          </button>
        </div>
      )}
    </section>
  );
}
