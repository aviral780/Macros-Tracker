"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { fmt } from "@/lib/nutrition";
import type { CardioEntry, TrainingPlan } from "@/lib/types";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

export function CardioBlock({
  date,
  cardio,
  plan,
  week,
  onChange,
}: {
  date: string;
  cardio: CardioEntry[];
  plan: TrainingPlan;
  week: { days: number; minutes: number };
  onChange: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try {
      await fn();
      onChange();
    } catch (e) {
      toast(e instanceof Error ? e.message : failure, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const logPreset = () =>
    run(
      () =>
        api("/api/cardio", {
          method: "POST",
          body: { date, kind: plan.cardioKind, minutes: plan.cardioMinutes, incline: plan.cardioIncline },
        }),
      "Couldn't log cardio",
    );

  const remove = (id: number) => run(() => api(`/api/cardio/${id}`, { method: "DELETE" }), "Couldn't remove that");

  const minutes = cardio.reduce((s, c) => s + c.minutes, 0);
  const hitTarget = week.days >= plan.cardioPerWeek;

  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center gap-3 px-4 pb-3 pt-3.5">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-panel-2 text-train">
          <Icon name="clock" />
        </span>
        <div className="min-w-0">
          <p className="eyebrow">Cardio</p>
          <h2 className="semi-condensed text-[19px] font-bold leading-tight">
            {minutes > 0 ? `${fmt(minutes)} min today` : "Nothing yet today"}
          </h2>
        </div>
        <div className="ml-auto text-right">
          <span className="flex items-center justify-end gap-1">
            {Array.from({ length: plan.cardioPerWeek }, (_, i) => (
              <span
                key={i}
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: i < week.days ? "var(--train)" : "var(--train-track)" }}
              />
            ))}
          </span>
          <span className={`mt-1 block text-[12px] tnum ${hitTarget ? "font-semibold text-train" : "text-muted"}`}>
            {week.days}/{plan.cardioPerWeek} this week
          </span>
        </div>
      </header>

      {cardio.length > 0 && (
        <ul className="border-t border-line">
          {cardio.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{c.kind}</span>
                <span className="block text-[13px] text-muted tnum">
                  {[
                    `${fmt(c.minutes)} min`,
                    c.incline ? `${fmt(c.incline)}% incline` : "",
                    c.speed ? `${fmt(c.speed, 1)} km/h` : "",
                    c.distance_km ? `${fmt(c.distance_km, 2)} km` : "",
                    c.calories ? `${fmt(c.calories)} kcal` : "",
                    c.source === "health" ? "from Health" : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <button
                className="btn btn-quiet btn-icon btn-sm"
                aria-label={`Remove ${c.kind}`}
                disabled={busy}
                onClick={() => remove(c.id)}
              >
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line px-4 py-3">
        <button className="btn btn-ghost btn-sm w-full" disabled={busy} onClick={logPreset}>
          <Icon name="plus" size={16} />
          Log {plan.cardioMinutes} min {plan.cardioKind.toLowerCase()}
        </button>
      </div>
    </section>
  );
}
