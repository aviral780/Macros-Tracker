import { fmt } from "@/lib/nutrition";
import type { Goals, Macros } from "@/lib/types";
import { Icon } from "./Icon";

const MACRO_ROWS = [
  { key: "protein", label: "Protein", fill: "var(--protein)", track: "var(--protein-track)", overIsBad: false },
  { key: "carbs", label: "Carbohydrate", fill: "var(--carbs)", track: "var(--carbs-track)", overIsBad: true },
  { key: "fat", label: "Total fat", fill: "var(--fat)", track: "var(--fat-track)", overIsBad: true },
] as const;

const pct = (v: number, goal: number) => (goal > 0 ? (v / goal) * 100 : 0);

export function Meter({ value, goal, fill, track, label }: { value: number; goal: number; fill: string; track: string; label: string }) {
  const p = pct(value, goal);
  return (
    <div
      className="meter"
      style={{ "--track": track } as React.CSSProperties}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(goal)}
      aria-valuenow={Math.round(value)}
    >
      <span style={{ width: `${Math.min(100, p)}%`, background: fill }} />
    </div>
  );
}

/** Today's intake set as a Nutrition Facts panel: the day is the serving. */
export function NutritionLabel({ totals, goals, dayLabel, loading }: { totals: Macros; goals: Goals; dayLabel: string; loading?: boolean }) {
  const left = goals.calories - totals.calories;
  const over = left < 0;
  return (
    <section aria-label="Daily nutrition" className={`facts transition-opacity ${loading ? "opacity-60" : ""}`}>
      <h2 className="condensed text-[40px] font-black leading-[0.95] md:text-[44px]">Nutrition Facts</h2>
      <div className="mt-1 flex items-baseline justify-between text-[15px]">
        <span>{dayLabel}</span>
        <span className="text-ink-2">1 day per serving</span>
      </div>
      <div className="rule-xl" />
      <div className="text-[13px] font-bold">Amount so far</div>
      <div className="flex items-end justify-between gap-3">
        <span className="condensed text-[34px] font-black leading-none">Calories</span>
        <span className="condensed text-[64px] font-black leading-[0.85] md:text-[72px]">{fmt(totals.calories)}</span>
      </div>
      <div className="mt-3">
        <Meter
          value={totals.calories}
          goal={goals.calories}
          fill={over ? "var(--critical)" : "var(--kcal)"}
          track="var(--kcal-track)"
          label="Calories eaten against goal"
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[14px]">
        <span className="text-ink-2">
          Goal <span className="tnum font-semibold text-ink">{fmt(goals.calories)}</span>
        </span>
        {over ? (
          <span className="flex items-center gap-1 font-bold text-critical">
            <Icon name="alert" size={15} strokeWidth={2.2} />
            {fmt(-left)} over
          </span>
        ) : (
          <span className="font-bold">
            <span className="tnum">{fmt(left)}</span> left
          </span>
        )}
      </div>
      <div className="rule-md" />
      <div className="text-right text-[13px] font-bold">% Goal*</div>
      <div className="rule-hair" />
      {MACRO_ROWS.map((m, i) => {
        const value = totals[m.key];
        const goal = goals[m.key];
        const p = pct(value, goal);
        return (
          <div key={m.key}>
            <div className="py-2">
              <div className="flex items-baseline justify-between gap-2 text-[15px]">
                <span>
                  <span className="font-bold">{m.label}</span>{" "}
                  <span className="tnum">{fmt(value)}g</span>
                  <span className="text-muted"> / {fmt(goal)}g</span>
                </span>
                <span className="flex items-center gap-1 font-bold tnum">
                  {m.overIsBad && p > 105 && <Icon name="alert" size={14} strokeWidth={2.2} className="text-critical" />}
                  {Math.round(p)}%
                </span>
              </div>
              <div className="mt-1.5">
                <Meter value={value} goal={goal} fill={m.fill} track={m.track} label={`${m.label} eaten against goal`} />
              </div>
            </div>
            {i < MACRO_ROWS.length - 1 && <div className="rule-hair" />}
          </div>
        );
      })}
      <div className="rule-xl" />
      <p className="text-[12px] leading-snug text-ink-2">
        * Percent of your daily targets. Protein counts 4 kcal/g, carbohydrate 4 kcal/g, fat 9 kcal/g.
      </p>
    </section>
  );
}
