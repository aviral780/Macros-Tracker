"use client";

import { useState } from "react";
import { api, useData } from "@/lib/client";
import { ACTIVITY_LEVELS, calculateGoals, fmt } from "@/lib/nutrition";
import type { GoalType, Goals, Profile } from "@/lib/types";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

type Resp = { profile: Profile; goals: Goals; goalsSet: boolean };
type Targets = { calories: string; protein: string; carbs: string; fat: string };

const GOAL_OPTIONS: { id: GoalType; label: string }[] = [
  { id: "cut", label: "Lose fat" },
  { id: "maintain", label: "Maintain" },
  { id: "bulk", label: "Build muscle" },
];

const toTargets = (g: { calories: number; protein: number; carbs: number; fat: number }): Targets => ({
  calories: String(g.calories),
  protein: String(g.protein),
  carbs: String(g.carbs),
  fat: String(g.fat),
});

export function GoalsView() {
  const { data } = useData<Resp>("/api/goals");
  if (!data) return <div className="panel h-96 animate-pulse" />;
  return <GoalsForm initial={data} />;
}

function GoalsForm({ initial }: { initial: Resp }) {
  const toast = useToast();
  const [p, setP] = useState<Profile>(initial.profile);
  const [targets, setTargets] = useState<Targets>(() =>
    toTargets(initial.goalsSet ? initial.goals : calculateGoals(initial.profile)),
  );
  const [manual, setManual] = useState(initial.goals.source === "manual");
  const [saving, setSaving] = useState(false);

  const calc = calculateGoals(p);
  const update = (patch: Partial<Profile>) => {
    const next = { ...p, ...patch };
    setP(next);
    if (!manual) setTargets(toTargets(calculateGoals(next)));
  };
  const editTarget = (k: keyof Targets, v: string) => {
    setManual(true);
    setTargets({ ...targets, [k]: v });
  };
  const macroKcal = Number(targets.protein) * 4 + Number(targets.carbs) * 4 + Number(targets.fat) * 9;
  const weeklyKg = ((calc.calories - calc.tdee) * 7) / 7700;

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/goals", {
        method: "PUT",
        body: {
          profile: p,
          goals: {
            calories: Math.round(Number(targets.calories)),
            protein: Number(targets.protein),
            carbs: Number(targets.carbs),
            fat: Number(targets.fat),
            source: manual ? "manual" : "calculated",
          },
        },
      });
      toast("Saved targets");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const numField = (label: string, value: number, unit: string, onChange: (n: number) => void, step = 1) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <span className="relative block">
        <input
          className="field tnum pr-12"
          type="number"
          inputMode="decimal"
          step={step}
          value={Number.isNaN(value) ? "" : value}
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
      </span>
    </label>
  );

  return (
    <div className="animate-fade">
      <header className="mb-5">
        <p className="eyebrow">Daily targets</p>
        <h1 className="condensed text-[34px] font-black leading-tight">Goals</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <section className="panel grid gap-5 p-5">
          <h2 className="semi-condensed text-[20px] font-bold">About you</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <span className="field-label">Sex</span>
              <div className="segmented w-full" role="group" aria-label="Sex">
                {(["male", "female"] as const).map((s) => (
                  <button key={s} className="flex-1" aria-pressed={p.sex === s} onClick={() => update({ sex: s })}>
                    {s === "male" ? "Male" : "Female"}
                  </button>
                ))}
              </div>
            </div>
            {numField("Age", p.age, "yrs", (n) => update({ age: n }))}
            {numField("Height", p.heightCm, "cm", (n) => update({ heightCm: n }))}
            {numField("Weight", p.weightKg, "kg", (n) => update({ weightKg: n }), 0.1)}
          </div>

          <label className="block">
            <span className="field-label">Activity</span>
            <select className="field" value={p.activity} onChange={(e) => update({ activity: Number(e.target.value) })}>
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label} — {a.hint}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="field-label">Goal</span>
            <div className="segmented w-full" role="group" aria-label="Goal">
              {GOAL_OPTIONS.map((g) => (
                <button key={g.id} className="flex-1" aria-pressed={p.goal === g.id} onClick={() => update({ goal: g.id })}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {p.goal !== "maintain" && (
            <Slider
              label={p.goal === "cut" ? "Deficit" : "Surplus"}
              value={p.rate}
              min={0.05}
              max={p.goal === "cut" ? 0.25 : 0.2}
              step={0.01}
              display={`${Math.round(p.rate * 100)}% · ${weeklyKg >= 0 ? "+" : "−"}${Math.abs(weeklyKg).toFixed(2)} kg/week`}
              onChange={(v) => update({ rate: v })}
            />
          )}
          <Slider
            label="Protein"
            value={p.proteinPerKg}
            min={1.2}
            max={3}
            step={0.1}
            display={`${p.proteinPerKg.toFixed(1)} g per kg bodyweight`}
            onChange={(v) => update({ proteinPerKg: v })}
          />
          <Slider label="Fat" value={p.fatPct} min={0.15} max={0.4} step={0.01} display={`${Math.round(p.fatPct * 100)}% of calories`} onChange={(v) => update({ fatPct: v })} />
          <p className="text-[13px] leading-relaxed text-muted">
            Uses the Mifflin–St Jeor equation. Carbohydrate fills the calories left after protein and fat. Lifters building or keeping muscle usually do well
            on 1.6–2.2 g of protein per kg.
          </p>
        </section>

        <section className="facts lg:sticky lg:top-8">
          <h2 className="condensed text-[30px] font-black leading-none">Daily targets</h2>
          <div className="rule-xl" />
          <dl className="grid grid-cols-2 gap-y-1 text-[14px]">
            <dt className="text-ink-2">Resting burn (BMR)</dt>
            <dd className="text-right font-semibold tnum">{fmt(calc.bmr)} kcal</dd>
            <dt className="text-ink-2">Maintenance (TDEE)</dt>
            <dd className="text-right font-semibold tnum">{fmt(calc.tdee)} kcal</dd>
          </dl>
          <div className="rule-md" />
          <div className="grid gap-3 py-1">
            <TargetField label="Calories" unit="kcal" value={targets.calories} onChange={(v) => editTarget("calories", v)} big />
            <div className="grid grid-cols-3 gap-2">
              <TargetField label="Protein" unit="g" dot="var(--protein)" value={targets.protein} onChange={(v) => editTarget("protein", v)} />
              <TargetField label="Carbs" unit="g" dot="var(--carbs)" value={targets.carbs} onChange={(v) => editTarget("carbs", v)} />
              <TargetField label="Fat" unit="g" dot="var(--fat)" value={targets.fat} onChange={(v) => editTarget("fat", v)} />
            </div>
          </div>
          <div className="rule-hair my-2" />
          {manual ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="text-ink-2">
                Custom targets · macros add up to <span className="font-semibold text-ink tnum">{fmt(macroKcal)}</span> kcal
              </span>
              <button
                className="font-semibold underline underline-offset-2"
                onClick={() => {
                  setManual(false);
                  setTargets(toTargets(calc));
                }}
              >
                Use calculated
              </button>
            </div>
          ) : (
            <p className="text-[13px] text-ink-2">Calculated from your details. Edit any number to set your own.</p>
          )}
          <button className="btn btn-primary mt-4 w-full" onClick={save} disabled={saving}>
            <Icon name="check" size={18} />
            {saving ? "Saving…" : "Save targets"}
          </button>
        </section>
      </div>
    </div>
  );
}

function Slider(props: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="field-label mb-0">{props.label}</span>
        <span className="text-[14px] font-semibold tnum">{props.display}</span>
      </span>
      <input
        type="range"
        className="w-full accent-[var(--ink)]"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

function TargetField({ label, unit, value, onChange, dot, big }: { label: string; unit: string; value: string; onChange: (v: string) => void; dot?: string; big?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[13px] font-bold">
        {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} aria-hidden />}
        {label}
      </span>
      <span className="relative block">
        <input
          className={`field tnum pr-11 font-bold ${big ? "condensed h-14 text-[30px] font-black" : ""}`}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
      </span>
    </label>
  );
}
