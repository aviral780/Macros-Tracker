import { fmt } from "@/lib/nutrition";
import type { Goals, Macros } from "@/lib/types";
import { Icon } from "./Icon";

const SIZE = 188;
const STROKE = 16;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const MACROS = [
  { key: "protein", label: "Protein", color: "var(--protein)", track: "var(--protein-track)", kcalPerG: 4 },
  { key: "carbs", label: "Carbs", color: "var(--carbs)", track: "var(--carbs-track)", kcalPerG: 4 },
  { key: "fat", label: "Fat", color: "var(--fat)", track: "var(--fat-track)", kcalPerG: 9 },
] as const;

const pct = (v: number, goal: number) => (goal > 0 ? (v / goal) * 100 : 0);

/** Today's intake: one calorie dial, three macro tracks, and where the energy came from. */
export function DaySummary({
  totals,
  goals,
  fiber,
  dayLabel,
  loading,
}: {
  totals: Macros;
  goals: Goals;
  fiber: number;
  dayLabel: string;
  loading?: boolean;
}) {
  const left = goals.calories - totals.calories;
  const over = left < 0;
  const done = pct(totals.calories, goals.calories);

  const energy = MACROS.map((m) => ({ ...m, kcal: totals[m.key] * m.kcalPerG }));
  const energyTotal = energy.reduce((s, e) => s + e.kcal, 0);

  return (
    <section
      aria-label="Today's nutrition"
      className={`panel overflow-hidden transition-opacity ${loading ? "opacity-60" : ""}`}
    >
      <div className="flex flex-col items-center px-5 pt-4">
        <div className="flex w-full items-baseline justify-between">
          <p className="eyebrow">Energy</p>
          <p className="text-[13px] text-muted">{dayLabel}</p>
        </div>

        <div className="relative mt-3" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            className="-rotate-90"
            role="meter"
            aria-label="Calories eaten against goal"
            aria-valuemin={0}
            aria-valuemax={Math.round(goals.calories)}
            aria-valuenow={Math.round(totals.calories)}
          >
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--kcal-track)" strokeWidth={STROKE} />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={over ? "var(--critical)" : "var(--kcal)"}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - Math.min(1, done / 100))}
              style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <span className="condensed block text-[58px] font-black leading-[0.85] tnum">{fmt(Math.abs(left))}</span>
            <span
              className={`mt-1 flex items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
                over ? "text-critical" : "text-muted"
              }`}
            >
              {over && <Icon name="alert" size={13} strokeWidth={2.4} />}
              {over ? "over goal" : "kcal left"}
            </span>
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 border-y border-line text-center">
        {[
          ["Eaten", fmt(totals.calories)],
          ["Goal", fmt(goals.calories)],
          ["Of goal", `${Math.round(done)}%`],
        ].map(([k, v]) => (
          <div key={k} className="border-r border-line py-2.5 last:border-r-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
            <dd className="text-[18px] font-bold tnum">{v}</dd>
          </div>
        ))}
      </dl>

      <ul className="px-5 py-1.5">
        {MACROS.map((m) => {
          const value = totals[m.key];
          const goal = goals[m.key];
          const p = pct(value, goal);
          const remaining = goal - value;
          return (
            <li key={m.key} className="py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-2 text-[14px] font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                  {m.label}
                </span>
                <span className="text-[13px] text-muted tnum">
                  <span className="text-[16px] font-bold text-ink">{fmt(value)}</span> / {fmt(goal)} g
                </span>
              </div>
              <div className="meter mt-1.5" style={{ "--track": m.track } as React.CSSProperties}>
                <span
                  style={{ width: `${Math.min(100, p)}%`, background: m.color }}
                  role="meter"
                  aria-label={`${m.label} eaten against goal`}
                  aria-valuemin={0}
                  aria-valuemax={Math.round(goal)}
                  aria-valuenow={Math.round(value)}
                />
              </div>
              <div className="mt-1 flex justify-between text-[12px] text-muted tnum">
                <span>{Math.round(p)}% of target</span>
                <span>{remaining >= 0 ? `${fmt(remaining)} g to go` : `${fmt(-remaining)} g over`}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line px-5 py-3.5">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Where the energy came from</p>
          <p className="text-[12px] text-muted tnum">
            Fiber <span className="font-semibold text-ink">{fmt(fiber)} g</span>
          </p>
        </div>
        <div className="mt-2 flex h-2.5 gap-px overflow-hidden rounded-full bg-panel-2">
          {energy.map((e) => (
            <span
              key={e.key}
              style={{ width: `${energyTotal > 0 ? (e.kcal / energyTotal) * 100 : 0}%`, background: e.color }}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted tnum">
          {energy.map((e) => (
            <span key={e.key}>
              <span className="font-semibold text-ink">
                {energyTotal > 0 ? Math.round((e.kcal / energyTotal) * 100) : 0}%
              </span>{" "}
              {e.label.toLowerCase()}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
