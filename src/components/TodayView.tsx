"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/lib/client";
import { formatDay, relativeDayLabel, todayISO } from "@/lib/dates";
import { fmt, sumMacros } from "@/lib/nutrition";
import { formatSet, setVolume } from "@/lib/strength";
import { useDate } from "@/lib/useDate";
import { MEAL_LABEL, MEALS, type CardioEntry, type FoodEntry, type Goals, type Workout } from "@/lib/types";
import { DateNav } from "./DateNav";
import { DaySummary } from "./DaySummary";
import { FoodEditSheet } from "./FoodEditSheet";
import { FoodTags } from "./FoodTags";
import { HealthCard, type Budget, type DailyMetrics } from "./HealthCard";
import { Icon } from "./Icon";
import { MacroLine } from "./MacroLine";
import { MomentumCard } from "./MomentumCard";

type Day = {
  date: string;
  goals: Goals;
  goalsSet: boolean;
  entries: FoodEntry[];
  workouts: Workout[];
  cardio: CardioEntry[];
  nextDay: string;
  metrics: DailyMetrics | null;
  budget: Budget | null;
};

export function TodayView() {
  const [date, setDate] = useDate();
  const { data, loading, error, reload } = useData<Day>(`/api/day?date=${date}`);
  const [editing, setEditing] = useState<FoodEntry | null>(null);

  const onDay = data?.date === date ? data : null;
  const entries = data?.date === date ? data.entries : [];
  const totals = sumMacros(entries);
  const fiber = entries.reduce((s, e) => s + e.fiber, 0);
  // The momentum card and "next up" describe where you are right now, so they only
  // make sense on today — on a past day they would claim a session is still due.
  const isToday = date === todayISO();
  const goals = data?.goals ?? { calories: 0, protein: 0, carbs: 0, fat: 0, source: "calculated" as const };
  const q = `date=${date}`;

  return (
    <div className="animate-fade">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{formatDay(date, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="condensed text-[34px] font-black leading-tight">{relativeDayLabel(date)}</h1>
        </div>
        <DateNav date={date} onChange={setDate} />
      </header>

      {error && (
        <div className="panel mb-4 flex items-center gap-3 border-critical/40 p-4 text-sm">
          <Icon name="alert" className="text-critical" />
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {data && !data.goalsSet && (
        <Link href="/goals" className="panel mb-4 flex items-center gap-3 p-4 text-sm hover:border-line-strong">
          <Icon name="target" className="shrink-0" />
          <span>
            <span className="font-semibold">Set your targets.</span>{" "}
            <span className="text-ink-2">Using a 2,400 kcal placeholder until you do.</span>
          </span>
          <Icon name="right" size={18} className="ml-auto shrink-0 text-muted" />
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-8">
          <DaySummary
            totals={totals}
            goals={goals}
            fiber={fiber}
            dayLabel={formatDay(date, { weekday: "long", day: "numeric", month: "short" })}
            loading={loading && !!data}
          />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href={`/log?${q}`} className="btn btn-primary">
              <Icon name="camera" size={18} />
              Snap a meal
            </Link>
            <Link href={`/log?mode=describe&${q}`} className="btn btn-ghost">
              <Icon name="text" size={18} />
              Describe it
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          {isToday && <MomentumCard />}
          {onDay?.metrics && (
            <HealthCard
              metrics={onDay.metrics}
              budget={onDay.budget}
              goalCalories={goals.calories}
              eaten={totals.calories}
            />
          )}
          {MEALS.map((meal) => {
            const items = entries.filter((e) => e.meal === meal);
            const t = sumMacros(items);
            return (
              <section key={meal} className="panel overflow-hidden" aria-labelledby={`meal-${meal}`}>
                <header className="flex items-center gap-3 px-4 pb-2 pt-3.5">
                  <div className="min-w-0">
                    <h2 id={`meal-${meal}`} className="semi-condensed text-[19px] font-bold leading-tight">
                      {MEAL_LABEL[meal]}
                    </h2>
                    {items.length > 0 && <MacroLine {...t} className="mt-0.5" />}
                  </div>
                  <span className="ml-auto text-right">
                    <span className="block text-[17px] font-bold leading-tight tnum">{fmt(t.calories)}</span>
                    <span className="block text-[11px] text-muted">kcal</span>
                  </span>
                  <Link href={`/log?meal=${meal}&${q}`} className="btn btn-quiet btn-icon btn-sm" aria-label={`Add to ${MEAL_LABEL[meal]}`}>
                    <Icon name="plus" size={18} />
                  </Link>
                </header>
                {items.length > 0 ? (
                  <ul className="border-t border-line">
                    {items.map((e) => (
                      <li key={e.id} className="border-b border-line last:border-b-0">
                        <button onClick={() => setEditing(e)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-panel-2">
                          {e.photo_id ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/api/photos/${e.photo_id}`} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" loading="lazy" />
                          ) : (
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-panel-2 text-[15px] font-bold text-ink-2">
                              {e.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold">{e.name}</span>
                            <span className="block truncate text-[13px] text-muted">
                              {[e.portion, e.grams ? `${fmt(e.grams)} g` : ""].filter(Boolean).join(" · ") || "—"}
                            </span>
                            <FoodTags item={e} className="mt-1" />
                          </span>
                          <span className="text-right">
                            <span className="block text-[15px] font-semibold tnum">{fmt(e.calories)}</span>
                            <MacroLine protein={e.protein} carbs={e.carbs} fat={e.fat} className="hidden sm:inline-flex" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 pb-3.5 text-[14px] text-muted">Nothing logged yet.</p>
                )}
              </section>
            );
          })}

          <TrainingCard
            workouts={data?.date === date ? data.workouts : []}
            cardio={data?.date === date ? data.cardio : []}
            nextDay={data?.date === date && isToday ? data.nextDay : ""}
            q={q}
          />
        </div>
      </div>

      <FoodEditSheet entry={editing} onClose={() => setEditing(null)} onChanged={reload} />
    </div>
  );
}

function CardioLine({ cardio }: { cardio: CardioEntry[] }) {
  if (cardio.length === 0) return null;
  const minutes = cardio.reduce((s, c) => s + c.minutes, 0);
  return (
    <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-[14px]">
      <Icon name="clock" size={16} className="text-train" />
      <span className="font-medium">{fmt(minutes)} min cardio</span>
      <span className="ml-auto truncate text-[13px] text-muted">{cardio.map((c) => c.kind).join(", ")}</span>
    </div>
  );
}

function TrainingCard({
  workouts,
  cardio,
  nextDay,
  q,
}: {
  workouts: Workout[];
  cardio: CardioEntry[];
  nextDay: string;
  q: string;
}) {
  const w = workouts[0];
  if (!w) {
    return (
      <section className="panel overflow-hidden">
        <div className="flex items-center gap-4 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-panel-2 text-train">
            <Icon name="dumbbell" />
          </span>
          <div className="min-w-0">
            <h2 className="semi-condensed text-[19px] font-bold leading-tight">Training</h2>
            <p className="truncate text-[14px] text-muted">{nextDay ? `Next up · ${nextDay}` : "No workout logged."}</p>
          </div>
          <Link href={`/train?${q}`} className="btn btn-ghost btn-sm ml-auto shrink-0">
            Start workout
          </Link>
        </div>
        <CardioLine cardio={cardio} />
      </section>
    );
  }
  const allSets = w.exercises.flatMap((e) => e.sets);
  const working = allSets.filter((s) => !s.warmup);
  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center gap-3 px-4 pb-3 pt-3.5">
        <span className="grid h-11 w-11 place-items-center rounded-lg text-panel" style={{ background: "var(--train)" }}>
          <Icon name="dumbbell" />
        </span>
        <div className="min-w-0">
          <p className="eyebrow">Training{w.duration_min ? ` · ${fmt(w.duration_min)} min` : ""}</p>
          <h2 className="semi-condensed truncate text-[19px] font-bold leading-tight">{w.name}</h2>
        </div>
        <Link href={`/train?${q}`} className="btn btn-ghost btn-sm ml-auto">
          Open
        </Link>
      </header>
      <dl className="grid grid-cols-3 border-y border-line text-center">
        {[
          ["Exercises", w.exercises.length],
          ["Working sets", working.length],
          ["Volume", `${fmt(setVolume(allSets))} kg`],
        ].map(([k, v]) => (
          <div key={k} className="border-r border-line py-2.5 last:border-r-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
            <dd className="text-[17px] font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="px-4 py-2">
        {w.exercises.map((e) => {
          const ws = e.sets.filter((s) => !s.warmup && s.reps > 0);
          return (
            <li key={e.id} className="flex justify-between gap-3 py-1.5 text-[14px]">
              <span className="truncate font-medium">{e.name}</span>
              <span className="shrink-0 text-ink-2 tnum">{ws.length ? ws.map(formatSet).join("  ") : "No sets"}</span>
            </li>
          );
        })}
      </ul>
      <CardioLine cardio={cardio} />
    </section>
  );
}
