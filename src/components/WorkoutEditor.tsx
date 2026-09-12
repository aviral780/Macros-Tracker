"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";
import { formatDay } from "@/lib/dates";
import { fmt } from "@/lib/nutrition";
import { e1rm, formatSet, setVolume, trimKg } from "@/lib/strength";
import type { Workout, WorkoutExercise, WorkoutSet } from "@/lib/types";
import { ExercisePicker } from "./ExercisePicker";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

export function WorkoutEditor({ workout, onChange, onDeleted }: { workout: Workout; onChange: (w: Workout) => void; onDeleted: () => void }) {
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState(workout.name);
  const [notes, setNotes] = useState(workout.notes);

  const mutate = async (url: string, method: string, body?: unknown) => {
    try {
      const r = await api<{ workout: Workout }>(url, { method, body });
      onChange(r.workout);
      return r.workout;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", { tone: "error" });
    }
  };

  const allSets = workout.exercises.flatMap((e) => e.sets);
  const prs = workout.exercises.filter((e) => e.previousBest > 0 && e.sets.some((s) => !s.warmup && e1rm(s.weight, s.reps) > e.previousBest)).length;

  return (
    <div className="grid gap-4">
      <section className="panel p-4">
        <div className="flex items-center gap-2">
          <input
            className="field semi-condensed h-11 flex-1 border-transparent bg-transparent px-1.5 text-[22px] font-bold hover:border-line-strong focus:border-ink"
            value={name}
            aria-label="Workout name"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== workout.name && mutate(`/api/workouts/${workout.id}`, "PATCH", { name: name.trim() })}
          />
          <button
            className="btn btn-quiet btn-icon btn-sm"
            aria-label="Delete workout"
            onClick={async () => {
              if (!confirm(`Delete ${workout.name} and all its sets?`)) return;
              await api(`/api/workouts/${workout.id}`, { method: "DELETE" });
              toast(`Deleted ${workout.name}`);
              onDeleted();
            }}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
        <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[
            ["Exercises", String(workout.exercises.length)],
            ["Sets", String(allSets.filter((s) => !s.warmup && s.reps > 0).length)],
            ["Volume", `${fmt(setVolume(allSets))}`],
            ["PRs", String(prs)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-panel-2 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k === "Volume" ? "Volume kg" : k}</dt>
              <dd className="text-[18px] font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {workout.exercises.map((ex) => (
        <ExerciseCard key={ex.id} ex={ex} mutate={mutate} />
      ))}

      <button className="btn btn-ghost h-12 border-dashed" onClick={() => setPicking(true)}>
        <Icon name="plus" size={18} />
        Add exercise
      </button>

      <label className="block">
        <span className="field-label">Notes</span>
        <textarea
          className="field min-h-[72px]"
          placeholder="Sleep, energy, anything that affected the session"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== workout.notes && mutate(`/api/workouts/${workout.id}`, "PATCH", { notes })}
        />
      </label>

      <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={(p) => mutate(`/api/workouts/${workout.id}/exercises`, "POST", p)} />
    </div>
  );
}

type Mutate = (url: string, method: string, body?: unknown) => Promise<Workout | undefined>;

function ExerciseCard({ ex, mutate }: { ex: WorkoutExercise; mutate: Mutate }) {
  const addSet = () => {
    const prev = ex.sets[ex.sets.length - 1];
    const fromLast = ex.last?.sets[ex.sets.filter((s) => !s.warmup).length] ?? ex.last?.sets[ex.last.sets.length - 1];
    const seed = prev ? { weight: prev.weight, reps: prev.reps } : fromLast ?? { weight: 0, reps: 0 };
    mutate(`/api/workout-exercises/${ex.id}/sets`, "POST", seed);
  };

  let workingIndex = 0;
  return (
    <section className="panel overflow-hidden">
      <header className="flex items-start gap-3 px-4 pt-3.5">
        <div className="min-w-0 flex-1">
          <Link href={`/train/exercise/${ex.exercise_id}`} className="semi-condensed text-[18px] font-bold leading-tight hover:underline">
            {ex.name}
          </Link>
          <p className="mt-0.5 text-[13px] text-muted">
            {ex.last ? (
              <>
                Last · {formatDay(ex.last.date, { day: "numeric", month: "short" })}:{" "}
                <span className="text-ink-2 tnum">{ex.last.sets.map(formatSet).join("  ")}</span>
              </>
            ) : (
              `${ex.muscle} · first time logging this`
            )}
          </p>
        </div>
        <button
          className="btn btn-quiet btn-icon btn-sm"
          aria-label={`Remove ${ex.name}`}
          onClick={() => (ex.sets.length === 0 || confirm(`Remove ${ex.name} and its sets?`)) && mutate(`/api/workout-exercises/${ex.id}`, "DELETE")}
        >
          <Icon name="x" size={16} />
        </button>
      </header>

      <div className="px-2 pb-3 pt-2">
        {ex.sets.length > 0 && (
          <div className="grid grid-cols-[44px_1fr_1fr_64px_36px] items-center gap-2 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <span className="text-center">Set</span>
            <span className="text-center">kg</span>
            <span className="text-center">Reps</span>
            <span className="text-center">e1RM</span>
            <span />
          </div>
        )}
        {ex.sets.map((s) => {
          const label = s.warmup ? "W" : String(++workingIndex);
          return <SetRow key={s.id} set={s} label={label} previousBest={ex.previousBest} mutate={mutate} />;
        })}
        <button className="btn btn-quiet btn-sm mx-2 mt-2" onClick={addSet}>
          <Icon name="plus" size={16} />
          Add set
        </button>
      </div>
    </section>
  );
}

function SetRow({ set, label, previousBest, mutate }: { set: WorkoutSet; label: string; previousBest: number; mutate: Mutate }) {
  const [weight, setWeight] = useState(set.weight ? trimKg(set.weight) : "");
  const [reps, setReps] = useState(set.reps ? String(set.reps) : "");
  const est = e1rm(Number(weight) || 0, Number(reps) || 0);
  const isPR = !set.warmup && previousBest > 0 && est > previousBest;

  const commit = (field: "weight" | "reps", raw: string) => {
    const v = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(v) || v === set[field]) return;
    mutate(`/api/sets/${set.id}`, "PATCH", { [field]: v });
  };

  return (
    <div className="grid grid-cols-[44px_1fr_1fr_64px_36px] items-center gap-2 rounded-lg px-2 py-1">
      <button
        className={`h-9 rounded-lg text-[14px] font-bold ${set.warmup ? "bg-panel-2 text-muted" : "text-ink"}`}
        title={set.warmup ? "Warm-up set — tap to count it" : "Tap to mark as warm-up"}
        aria-label={`Set ${label}${set.warmup ? ", warm-up" : ""}. Toggle warm-up`}
        onClick={() => mutate(`/api/sets/${set.id}`, "PATCH", { warmup: !set.warmup })}
      >
        {label}
      </button>
      <input
        className="cell-input"
        inputMode="decimal"
        aria-label="Weight in kg"
        placeholder="0"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={() => commit("weight", weight)}
        onFocus={(e) => e.target.select()}
      />
      <input
        className="cell-input"
        inputMode="numeric"
        aria-label="Reps"
        placeholder="0"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={() => commit("reps", reps)}
        onFocus={(e) => e.target.select()}
      />
      <span className="flex items-center justify-center gap-1 text-[13px] tnum text-ink-2">
        {isPR && <Icon name="trophy" size={14} strokeWidth={2.2} className="text-train" />}
        <span className={isPR ? "font-bold text-ink" : ""}>{est ? Math.round(est) : "—"}</span>
        {isPR && <span className="sr-only">Estimated one-rep max PR</span>}
      </span>
      <button className="btn btn-quiet btn-icon h-9 w-9 rounded-lg" aria-label="Delete set" onClick={() => mutate(`/api/sets/${set.id}`, "DELETE")}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
