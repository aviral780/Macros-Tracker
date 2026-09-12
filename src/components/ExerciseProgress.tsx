"use client";

import { formatDay } from "@/lib/dates";
import { fmt } from "@/lib/nutrition";
import { formatSet, trimKg } from "@/lib/strength";
import { Chart } from "./Chart";

type Session = { date: string; sets: { weight: number; reps: number }[]; e1rm: number; bestSet: { weight: number; reps: number }; volume: number; topWeight: number };

export function ExerciseProgress({ history, pr }: { history: Session[]; pr: Session | null }) {
  if (history.length === 0) {
    return <p className="panel p-5 text-[15px] text-ink-2">No sets logged for this exercise yet. Add it to a workout and your progress appears here.</p>;
  }
  const last = history[history.length - 1];
  const data = history.map((h, i) => ({ x: `${h.date}-${i}`, label: formatDay(h.date, { day: "numeric", month: "short" }), values: { e1rm: h.e1rm || null } }));
  const vol = history.map((h, i) => ({ x: `${h.date}-${i}`, label: formatDay(h.date, { day: "numeric", month: "short" }), values: { volume: h.volume } }));
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Estimated 1RM PR" value={pr ? `${trimKg(pr.e1rm)} kg` : "—"} sub={pr ? `${formatSet(pr.bestSet)} on ${formatDay(pr.date, { day: "numeric", month: "short" })}` : ""} />
        <Tile label="Last session" value={`${trimKg(last.e1rm)} kg`} sub={`e1RM · ${formatDay(last.date, { day: "numeric", month: "short" })}`} />
        <Tile label="Heaviest weight" value={`${trimKg(Math.max(...history.map((h) => h.topWeight)))} kg`} sub="Any rep count" />
        <Tile label="Sessions" value={String(history.length)} sub={`Since ${formatDay(history[0].date, { day: "numeric", month: "short", year: "numeric" })}`} />
      </div>
      <section className="panel p-4">
        <Chart title="Estimated 1RM (kg)" kind="line" data={data} series={[{ key: "e1rm", label: "e1RM", color: "var(--train)" }]} unit=" kg" connectGaps format={(v) => trimKg(Math.round(v * 10) / 10)} />
      </section>
      <section className="panel p-4">
        <Chart title="Volume per session (kg)" kind="bar" data={vol} series={[{ key: "volume", label: "Volume", color: "var(--train)" }]} unit=" kg" />
      </section>
      <section className="panel overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 text-[15px] font-bold">History</h2>
        <ul>
          {[...history].reverse().map((h, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 last:border-b-0">
              <span className="w-20 text-[14px] font-semibold">{formatDay(h.date, { day: "numeric", month: "short" })}</span>
              <span className="flex-1 text-[14px] text-ink-2 tnum">{h.sets.map(formatSet).join("  ")}</span>
              <span className="text-[13px] text-muted tnum">
                e1RM {trimKg(h.e1rm)} · {fmt(h.volume)} kg
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[13px] font-semibold text-ink-2">{label}</p>
      <p className="condensed mt-1 text-[32px] font-black leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-muted">{sub}</p>}
    </div>
  );
}
