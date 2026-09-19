"use client";

import { fmt } from "@/lib/nutrition";
import { Icon } from "./Icon";

export type DailyMetrics = {
  steps: number | null;
  active_energy: number | null;
  resting_energy: number | null;
  exercise_minutes: number | null;
  resting_hr: number | null;
  hrv: number | null;
  sleep_hours: number | null;
};

export type Budget = {
  calories: number;
  tdee: number;
  resting: number;
  active: number;
  estimatedResting: boolean;
};

/**
 * What the watch measured, and what it does to the day's budget. The headline
 * number replaces the profile estimate rather than adding to it — the activity
 * multiplier already assumes training, so stacking them double-counts.
 */
export function HealthCard({
  metrics,
  budget,
  goalCalories,
  eaten,
}: {
  metrics: DailyMetrics;
  budget: Budget | null;
  goalCalories: number;
  eaten: number;
}) {
  const stats = [
    metrics.steps !== null && { label: "Steps", value: fmt(metrics.steps) },
    metrics.exercise_minutes !== null && { label: "Exercise", value: `${fmt(metrics.exercise_minutes)} min` },
    metrics.resting_hr !== null && { label: "Resting HR", value: `${fmt(metrics.resting_hr)} bpm` },
    metrics.sleep_hours !== null && { label: "Sleep", value: `${fmt(metrics.sleep_hours, 1)} h` },
  ].filter((s): s is { label: string; value: string } => Boolean(s));

  if (!budget && stats.length === 0) return null;

  const difference = budget ? budget.calories - goalCalories : 0;
  const remaining = budget ? budget.calories - eaten : 0;

  return (
    <section className="panel overflow-hidden" aria-label="From Apple Health">
      <header className="flex items-center gap-3 px-4 pb-3 pt-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-panel-2 text-train">
          <Icon name="spark" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">From your watch</p>
          <h2 className="semi-condensed text-[19px] font-bold leading-tight">
            {budget ? `${fmt(budget.active)} kcal burned` : "Today's activity"}
          </h2>
        </div>
      </header>

      {budget && (
        <>
          <dl className="grid grid-cols-3 border-y border-line text-center">
            {[
              ["Budget", fmt(budget.calories)],
              ["Left", fmt(remaining)],
              ["Measured burn", fmt(budget.tdee)],
            ].map(([k, v]) => (
              <div key={k} className="border-r border-line py-2.5 last:border-r-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
                <dd className="text-[17px] font-bold tnum">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="px-4 py-2.5 text-[13px] leading-relaxed text-ink-2">
            {difference === 0
              ? "Today's measured burn matches your set target."
              : `${fmt(Math.abs(difference))} kcal ${difference > 0 ? "more" : "less"} than your ${fmt(goalCalories)} target, because your watch measured ${fmt(budget.resting)} resting plus ${fmt(budget.active)} active.`}
            {budget.estimatedResting && " Resting burn is estimated — Health hasn't sent it for today."}
          </p>
        </>
      )}

      {stats.length > 0 && (
        <dl className={`grid grid-cols-2 gap-px bg-line ${budget ? "border-t border-line" : "border-y border-line"}`}>
          {stats.map((s) => (
            <div key={s.label} className="bg-panel px-4 py-2.5">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{s.label}</dt>
              <dd className="text-[16px] font-bold tnum">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
