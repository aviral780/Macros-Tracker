"use client";

import { useMemo, useState } from "react";
import { api, useData } from "@/lib/client";
import { addDays, formatDay, todayISO } from "@/lib/dates";
import { fmt } from "@/lib/nutrition";
import type { Goals } from "@/lib/types";
import { Chart, type Datum } from "./Chart";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

type Trends = {
  from: string;
  to: string;
  goals: Goals;
  days: { date: string; calories: number; protein: number; carbs: number; fat: number }[];
  weights: { date: string; kg: number }[];
  training: { date: string; workouts: number; volume: number; sets: number }[];
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
    return { calories, protein, weight, volume, avg, onTarget, proteinHit, sessions, loggedDays: logged.length, firstW, lastW };
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
            <Tile label="Average calories" value={view.loggedDays ? fmt(view.avg.calories) : "—"} sub={`Goal ${fmt(data.goals.calories)} · ${view.loggedDays} days logged`} />
            <Tile label="Average protein" value={view.loggedDays ? `${fmt(view.avg.protein)} g` : "—"} sub={`Goal ${fmt(data.goals.protein)} g · hit on ${view.proteinHit} days`} />
            <Tile label="Days within 10% of calories" value={`${view.onTarget}`} sub={`of ${view.loggedDays} logged days`} />
            <Tile
              label="Bodyweight"
              value={view.lastW ? `${view.lastW.kg} kg` : "—"}
              sub={
                view.firstW && view.lastW && view.firstW.date !== view.lastW.date
                  ? `${view.lastW.kg - view.firstW.kg >= 0 ? "+" : "−"}${Math.abs(Math.round((view.lastW.kg - view.firstW.kg) * 10) / 10)} kg since ${formatDay(view.firstW.date, { day: "numeric", month: "short" })}`
                  : `${view.sessions} training sessions`
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
            <Chart
              title="Training volume per week (kg)"
              kind="bar"
              data={view.volume}
              series={[{ key: "volume", label: "Volume", color: "var(--train)" }]}
              unit=" kg"
              height={200}
            />
          </section>
        </div>
      )}
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
