"use client";

import { useMemo, useState } from "react";
import { api, useData } from "@/lib/client";
import { addDays, formatDay, todayISO } from "@/lib/dates";
import { fmt } from "@/lib/nutrition";
import type { Goals, TrainingPlan } from "@/lib/types";
import { Chart, type Datum } from "./Chart";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

type Trends = {
  from: string;
  to: string;
  goals: Goals;
  plan: TrainingPlan;
  streaks: { current: number; longest: number; totalDays: number };
  days: { date: string; calories: number; protein: number; carbs: number; fat: number }[];
  weights: { date: string; kg: number }[];
  training: { date: string; workouts: number; volume: number; sets: number }[];
  cardio: { date: string; minutes: number; sessions: number }[];
};

const RANGES = [7, 30, 90];

export function TrendsView() {
  const [range, setRange] = useState(30);
  const { data, loading, reload } = useData<Trends>(`/api/trends?days=${range}&to=${todayISO()}`);
  const toast = useToast();
  const [kg, setKg] = useState("");

  const view = useMemo(() => {
    if (!data) return null;
    const dates: string[] = [];
    for (let d = data.from; d <= data.to; d = addDays(d, 1)) dates.push(d);
    const byDay = new Map(data.days.map((d) => [d.date, d]));
    const byWeight = new Map(data.weights.map((w) => [w.date, w.kg]));
    const label = (d: string) => (range <= 7 ? formatDay(d, { weekday: "short" }) : formatDay(d, { day: "numeric", month: "short" }));

    const calories: Datum[] = dates.map((d) => {
      const r = byDay.get(d);
      return {
        x: d,
        label: label(d),
        values: r
          ? { protein: Math.round(r.protein * 4), carbs: Math.round(r.carbs * 4), fat: Math.round(r.fat * 9) }
          : { protein: null, carbs: null, fat: null },
      };
    });
    const protein: Datum[] = dates.map((d) => ({ x: d, label: label(d), values: { protein: byDay.get(d)?.protein ?? null } }));
    const weight: Datum[] = dates.map((d) => ({ x: d, label: label(d), values: { kg: byWeight.get(d) ?? null } }));

    // Weekly training volume, Monday-start weeks.
    const weeks = new Map<string, { volume: number; sessions: number }>();
    for (const t of data.training) {
      const dt = new Date(t.date + "T00:00:00");
      const monday = addDays(t.date, -((dt.getDay() + 6) % 7));
      const w = weeks.get(monday) ?? { volume: 0, sessions: 0 };
      w.volume += t.volume;
      w.sessions += t.workouts;
      weeks.set(monday, w);
    }
    const volume: Datum[] = [...weeks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([wk, v]) => ({ x: wk, label: formatDay(wk, { day: "numeric", month: "short" }), values: { volume: Math.round(v.volume) } }));

    const logged = data.days;
    const n = logged.length || 1;
    const avg = {
      calories: logged.reduce((a, d) => a + d.calories, 0) / n,
      protein: logged.reduce((a, d) => a + d.protein, 0) / n,
    };
    const onTarget = logged.filter((d) => Math.abs(d.calories - data.goals.calories) <= data.goals.calories * 0.1).length;
    const proteinHit = logged.filter((d) => d.protein >= data.goals.protein * 0.95).length;
    const sessions = data.training.reduce((a, t) => a + t.workouts, 0);
    const firstW = data.weights[0];
    const lastW = data.weights[data.weights.length - 1];

    // Per-day consistency, plus cardio rolled up into the same Monday weeks as volume.
    const trainedOn = new Set(data.training.filter((t) => t.workouts > 0).map((t) => t.date));
    const cardioByDay = new Map(data.cardio.map((c) => [c.date, c]));
    const consistency = dates.map((d) => ({
      date: d,
      label: label(d),
      trained: trainedOn.has(d),
      cardioMinutes: cardioByDay.get(d)?.minutes ?? 0,
    }));

    const cardioWeeks = new Map<string, number>();
    for (const c of data.cardio) {
      const monday = addDays(c.date, -((new Date(c.date + "T00:00:00").getDay() + 6) % 7));
      cardioWeeks.set(monday, (cardioWeeks.get(monday) ?? 0) + c.minutes);
    }
    const cardioChart: Datum[] = [...weeks.keys()]
      .concat([...cardioWeeks.keys()])
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a.localeCompare(b))
      .map((wk) => ({
        x: wk,
        label: formatDay(wk, { day: "numeric", month: "short" }),
        values: { minutes: Math.round(cardioWeeks.get(wk) ?? 0) },
      }));

    const cardioDays = data.cardio.length;
    const cardioMinutes = data.cardio.reduce((a, c) => a + c.minutes, 0);

    return {
      calories,
      protein,
      weight,
      volume,
      avg,
      onTarget,
      proteinHit,
      sessions,
      loggedDays: logged.length,
      firstW,
      lastW,
      consistency,
      cardioChart,
      cardioDays,
      cardioMinutes,
      totalDays: dates.length,
    };
  }, [data, range]);

  const logWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/weight", { method: "POST", body: { date: todayISO(), kg: Number(kg) } });
      toast("Logged weigh-in");
      setKg("");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save", { tone: "error" });
    }
  };

  return (
    <div className="animate-fade">
      <header className="mb-5">
        <p className="eyebrow">Progress</p>
        <h1 className="condensed text-[34px] font-black leading-tight">Trends</h1>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="segmented" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>
              Last {r} days
            </button>
          ))}
        </div>
      </div>

      {view && data && (
        <div className={`grid gap-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label="Training streak"
              value={data.streaks.current > 0 ? `${data.streaks.current}` : "—"}
              sub={`Best ${data.streaks.longest} · ${data.streaks.totalDays} days trained all time`}
            />
            <Tile label="Average calories" value={view.loggedDays ? fmt(view.avg.calories) : "—"} sub={`Goal ${fmt(data.goals.calories)} · ${view.loggedDays} days logged`} />
            <Tile label="Average protein" value={view.loggedDays ? `${fmt(view.avg.protein)} g` : "—"} sub={`Goal ${fmt(data.goals.protein)} g · hit on ${view.proteinHit} days`} />
            <Tile
              label="Bodyweight"
              value={view.lastW ? `${view.lastW.kg} kg` : "—"}
              sub={
                view.firstW && view.lastW && view.firstW.date !== view.lastW.date
                  ? `${view.lastW.kg - view.firstW.kg >= 0 ? "+" : "−"}${Math.abs(Math.round((view.lastW.kg - view.firstW.kg) * 10) / 10)} kg since ${formatDay(view.firstW.date, { day: "numeric", month: "short" })}`
                  : `${view.onTarget} of ${view.loggedDays} days within 10% of calories`
              }
            />
          </div>

          <section className="panel p-4">
            <Chart
              title="Calories by macro"
              kind="bar"
              data={view.calories}
              series={[
                { key: "protein", label: "Protein", color: "var(--protein)" },
                { key: "carbs", label: "Carbs", color: "var(--carbs)" },
                { key: "fat", label: "Fat", color: "var(--fat)" },
              ]}
              reference={{ value: data.goals.calories, label: `Goal ${fmt(data.goals.calories)}` }}
              unit=" kcal"
              height={250}
            />
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="panel p-4">
              <Chart
                title="Protein (g)"
                kind="line"
                data={view.protein}
                series={[{ key: "protein", label: "Protein", color: "var(--protein)" }]}
                reference={{ value: data.goals.protein, label: `Goal ${fmt(data.goals.protein)} g` }}
                unit=" g"
              />
            </section>
            <section className="panel p-4">
              <Chart title="Bodyweight (kg)" kind="line" data={view.weight} series={[{ key: "kg", label: "Bodyweight", color: "var(--ink)" }]} unit=" kg" connectGaps format={(v) => String(Math.round(v * 10) / 10)} emptyLabel="No weigh-in" />
              <form onSubmit={logWeight} className="mt-3 flex gap-2 border-t border-line pt-3">
                <label className="sr-only" htmlFor="kg">
                  Today&apos;s weight in kg
                </label>
                <input id="kg" className="field h-10" inputMode="decimal" placeholder="Today's weight, kg" value={kg} onChange={(e) => setKg(e.target.value)} />
                <button className="btn btn-primary h-10" disabled={!kg}>
                  <Icon name="scale" size={16} />
                  Log weigh-in
                </button>
              </form>
            </section>
          </div>

          <section className="panel p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-bold">Consistency</h2>
              <p className="text-[13px] text-muted tnum">
                {view.sessions} sessions · {view.cardioDays} cardio days · {fmt(view.cardioMinutes)} min
              </p>
            </div>
            <div className="mt-3 grid gap-2">
              <ConsistencyRow
                label="Training"
                color="var(--train)"
                track="var(--train-track)"
                days={view.consistency.map((d) => ({ ...d, on: d.trained }))}
              />
              <ConsistencyRow
                label="Cardio"
                color="var(--carbs)"
                track="var(--carbs-track)"
                days={view.consistency.map((d) => ({ ...d, on: d.cardioMinutes > 0 }))}
              />
            </div>
            <p className="mt-2.5 text-[12px] text-muted">
              Target {data.plan.days.length} sessions and {data.plan.cardioPerWeek} cardio days a week.
            </p>
          </section>

          <section className="panel p-4">
            <Chart
              title="Training volume per week (kg)"
              kind="bar"
              data={view.volume}
              series={[{ key: "volume", label: "Volume", color: "var(--train)" }]}
              unit=" kg"
              height={200}
            />
          </section>

          <section className="panel p-4">
            <Chart
              title="Cardio minutes per week"
              kind="bar"
              data={view.cardioChart}
              series={[{ key: "minutes", label: "Minutes", color: "var(--carbs)" }]}
              reference={{
                value: data.plan.cardioPerWeek * data.plan.cardioMinutes,
                label: `Target ${data.plan.cardioPerWeek * data.plan.cardioMinutes} min`,
              }}
              unit=" min"
              height={200}
            />
          </section>
        </div>
      )}
    </div>
  );
}

/** One square per day in range: filled when that day had the activity. */
function ConsistencyRow({
  label,
  color,
  track,
  days,
}: {
  label: string;
  color: string;
  track: string;
  days: { date: string; label: string; on: boolean }[];
}) {
  const hit = days.filter((d) => d.on).length;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-semibold">{label}</span>
        <span className="text-muted tnum">
          {hit} of {days.length} days
        </span>
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {days.map((d) => (
          <span
            key={d.date}
            title={`${d.label}${d.on ? "" : " — nothing logged"}`}
            className="h-6 min-w-0 flex-1 rounded-[3px]"
            style={{ background: d.on ? color : track }}
          />
        ))}
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[13px] font-semibold text-ink-2">{label}</p>
      <p className="condensed mt-1 text-[32px] font-black leading-none">{value}</p>
      <p className="mt-1.5 text-[12px] text-muted">{sub}</p>
    </div>
  );
}
