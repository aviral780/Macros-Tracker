"use client";

import Link from "next/link";
import { useState } from "react";
import { api, useData } from "@/lib/client";
import { formatDay, relativeDayLabel } from "@/lib/dates";
import { fmt } from "@/lib/nutrition";
import { useDate } from "@/lib/useDate";
import { DEFAULT_PLAN, type CardioEntry, type TrainingPlan, type Workout } from "@/lib/types";
import { CardioBlock } from "./CardioBlock";
import { DateNav } from "./DateNav";
import { Icon } from "./Icon";
import { useToast } from "./Toast";
import { WorkoutEditor } from "./WorkoutEditor";

type Day = {
  workouts: Workout[];
  date: string;
  cardio: CardioEntry[];
  cardioWeek: { days: number; minutes: number };
  plan: TrainingPlan;
  nextDay: string;
};
type History = {
  history: { id: number; date: string; name: string; duration_min: number | null; exercises: number; sets: number; volume: number }[];
  templates: { name: string; id: number }[];
};

export function TrainView() {
  const [date, setDate] = useDate();
  const toast = useToast();
  const day = useData<Day>(`/api/day?date=${date}`);
  const hist = useData<History>("/api/workouts");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onDay = day.data?.date === date ? day.data : null;
  const workouts = onDay?.workouts ?? [];
  const plan = onDay?.plan ?? DEFAULT_PLAN;
  const nextDay = onDay?.nextDay ?? plan.days[0];

  const start = async (body: { name: string; copyFrom?: number }) => {
    setBusy(true);
    try {
      await api("/api/workouts", { method: "POST", body: { date, ...body } });
      setName("");
      await day.reload();
      hist.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't start workout", { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const templateFor = (name: string) =>
    hist.data?.templates.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id;

  const replace = (w: Workout) =>
    day.setData((d) => (d ? { ...d, workouts: d.workouts.map((x) => (x.id === w.id ? w : x)) } : d));

  return (
    <div className="animate-fade">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{formatDay(date, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="condensed text-[34px] font-black leading-tight">Training</h1>
        </div>
        <DateNav date={date} onChange={setDate} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div>
          {day.loading && !day.data ? (
            <div className="panel h-40 animate-pulse" />
          ) : workouts.length > 0 ? (
            <div className="grid gap-8">
              {workouts.map((w) => (
                <WorkoutEditor
                  key={w.id}
                  workout={w}
                  onChange={(nw) => {
                    replace(nw);
                    hist.reload();
                  }}
                  onDeleted={() => {
                    day.reload();
                    hist.reload();
                  }}
                />
              ))}
            </div>
          ) : (
            <section className="panel p-5">
              <h2 className="semi-condensed text-[20px] font-bold">Start a workout for {relativeDayLabel(date).toLowerCase() === "today" ? "today" : formatDay(date)}</h2>

              <div className="mt-4">
                <p className="field-label">
                  Your split · next up <span className="text-ink">{nextDay}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {plan.days.map((d) => {
                    const isNext = d === nextDay;
                    return (
                      <button
                        key={d}
                        type="button"
                        className={`btn btn-sm ${isNext ? "btn-primary" : "btn-quiet"}`}
                        disabled={busy}
                        onClick={() => start({ name: d, copyFrom: templateFor(d) })}
                      >
                        {isNext && <Icon name="spark" size={14} />}
                        {d}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[13px] text-muted">
                  Starts the day and pulls in the exercises you did last time you trained it.
                </p>
              </div>

              {hist.data && hist.data.templates.length > 0 && (
                <div className="mt-5">
                  <p className="field-label">Repeat a previous session</p>
                  <div className="flex flex-wrap gap-2">
                    {hist.data.templates.map((t) => (
                      <button key={t.id} className="btn btn-ghost btn-sm" disabled={busy} onClick={() => start({ name: t.name, copyFrom: t.id })}>
                        <Icon name="copy" size={15} />
                        {t.name}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[13px] text-muted">Copies the exercise list. Last session&apos;s numbers show on every exercise as a target.</p>
                </div>
              )}
              <form
                className="mt-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  start({ name: name.trim() || "Workout" });
                }}
              >
                <label className="field-label" htmlFor="wname">
                  Or start fresh
                </label>
                <div className="flex gap-2">
                  <input id="wname" className="field" placeholder="Workout name" value={name} onChange={(e) => setName(e.target.value)} />
                  <button className="btn btn-primary" disabled={busy}>
                    Start
                  </button>
                </div>
              </form>
            </section>
          )}

          {onDay && (
            <div className="mt-6">
              <CardioBlock
                date={date}
                cardio={onDay.cardio}
                plan={plan}
                week={onDay.cardioWeek}
                onChange={() => day.reload()}
              />
            </div>
          )}
        </div>

        <aside className="panel overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 text-[15px] font-bold">Recent sessions</h2>
          {hist.data?.history.length ? (
            <ul>
              {hist.data.history.slice(0, 12).map((h) => (
                <li key={h.id} className="border-b border-line last:border-b-0">
                  <Link href={`/train?date=${h.date}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel-2">
                    <span className="w-12 shrink-0 text-center">
                      <span className="block text-[11px] font-semibold uppercase text-muted">{formatDay(h.date, { month: "short" })}</span>
                      <span className="condensed block text-[22px] font-black leading-none">{formatDay(h.date, { day: "numeric" })}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{h.name}</span>
                      <span className="block text-[13px] text-muted tnum">
                        {h.exercises} exercises · {h.sets} sets · {fmt(h.volume)} kg
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-[14px] text-muted">Sessions you log show up here.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
