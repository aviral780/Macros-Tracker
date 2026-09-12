"use client";

import { useState } from "react";
import { api, useData } from "@/lib/client";
import type { TrainingPlan } from "@/lib/types";
import { ExercisePicker } from "./ExercisePicker";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

type RoutineExercise = { id: number; exercise_id: number; name: string; muscle: string };
type Routines = { routines: { day: string; exercises: RoutineExercise[] }[] };

/** The saved exercise list for each split day — what a new session gets seeded with. */
export function RoutineEditor({ plan, nextDay }: { plan: TrainingPlan; nextDay: string }) {
  const toast = useToast();
  const { data, reload } = useData<Routines>("/api/routines");
  const [open, setOpen] = useState<string | null>(nextDay);
  const [adding, setAdding] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : failure, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const byDay = new Map(data?.routines.map((r) => [r.day, r.exercises]) ?? []);

  return (
    <section className="panel overflow-hidden">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-bold">Your split</h2>
        <p className="mt-0.5 text-[13px] text-muted">
          What each day starts with. Edit freely — changes apply to the next session you start.
        </p>
      </header>

      <ul>
        {plan.days.map((day) => {
          const exercises = byDay.get(day) ?? [];
          const isOpen = open === day;
          return (
            <li key={day} className="border-b border-line last:border-b-0">
              <button
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-panel-2"
                onClick={() => setOpen(isOpen ? null : day)}
                aria-expanded={isOpen}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{day}</span>
                  <span className="block text-[13px] text-muted">
                    {exercises.length > 0 ? `${exercises.length} exercises` : "Nothing saved yet"}
                  </span>
                </span>
                {day === nextDay && <span className="text-[11px] font-bold uppercase tracking-wide text-train">Next</span>}
                <Icon name={isOpen ? "right" : "right"} size={16} className={`text-muted transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>

              {isOpen && (
                <div className="px-4 pb-3">
                  <ol className="mb-2">
                    {exercises.map((ex, i) => (
                      <li key={ex.id} className="flex items-center gap-3 border-t border-line py-2">
                        <span className="w-5 shrink-0 text-[13px] text-muted tnum">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{ex.name}</span>
                        <span className="shrink-0 text-[12px] text-muted">{ex.muscle}</span>
                        <button
                          className="btn btn-quiet btn-icon btn-sm shrink-0"
                          aria-label={`Remove ${ex.name} from ${day}`}
                          disabled={busy}
                          onClick={() => run(() => api(`/api/routines/${ex.id}`, { method: "DELETE" }), "Couldn't remove that")}
                        >
                          <Icon name="x" size={15} />
                        </button>
                      </li>
                    ))}
                  </ol>
                  <button className="btn btn-ghost btn-sm w-full border-dashed" disabled={busy} onClick={() => setAdding(day)}>
                    <Icon name="plus" size={15} />
                    Add to {day}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <ExercisePicker
        open={adding !== null}
        onClose={() => setAdding(null)}
        onPick={(p) => {
          const day = adding;
          if (day) run(() => api("/api/routines", { method: "POST", body: { day, ...p } }), "Couldn't add that");
        }}
      />
    </section>
  );
}
