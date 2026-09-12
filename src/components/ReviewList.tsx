"use client";

import { fmt, round, sumMacros } from "@/lib/nutrition";
import type { DraftItem } from "@/lib/types";
import { Icon } from "./Icon";
import { MacroLine } from "./MacroLine";

/** A draft keeps the numbers it started with so weight changes can rescale macros proportionally. */
export type Draft = DraftItem & { base: { grams: number; calories: number; protein: number; carbs: number; fat: number; fiber: number } };

let counter = 0;
export function makeDraft(p: Partial<DraftItem> & { name: string }): Draft {
  const item: DraftItem = {
    key: `d${Date.now()}-${counter++}`,
    portion: "",
    grams: null,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    confidence: null,
    include: true,
    ...p,
  };
  return { ...item, base: snapshot(item) };
}

const snapshot = (i: DraftItem) => ({ grams: i.grams ?? 0, calories: i.calories, protein: i.protein, carbs: i.carbs, fat: i.fat, fiber: i.fiber });

function rescale(d: Draft, grams: number | null): Draft {
  if (!grams || grams <= 0 || d.base.grams <= 0) return { ...d, grams };
  const f = grams / d.base.grams;
  return {
    ...d,
    grams,
    calories: round(d.base.calories * f),
    protein: round(d.base.protein * f, 1),
    carbs: round(d.base.carbs * f, 1),
    fat: round(d.base.fat * f, 1),
    fiber: round(d.base.fiber * f, 1),
  };
}

export function ReviewList({ items, onChange }: { items: Draft[]; onChange: (items: Draft[]) => void }) {
  const update = (key: string, fn: (d: Draft) => Draft) => onChange(items.map((d) => (d.key === key ? fn(d) : d)));

  return (
    <ul className="grid gap-3">
      {items.map((d) => {
        // Editing a macro directly makes the edited values the new reference for scaling.
        const setMacro = (k: "calories" | "protein" | "carbs" | "fat", v: string) =>
          update(d.key, (x) => {
            const next = { ...x, [k]: v === "" ? 0 : Number(v) };
            return { ...next, base: snapshot(next) };
          });
        const lowConfidence = d.confidence != null && d.confidence < 0.55;
        return (
          <li key={d.key} className={`panel p-3.5 transition-opacity ${d.include ? "" : "opacity-50"}`}>
            <div className="flex items-start gap-2">
              <label className="mt-2.5 flex shrink-0 items-center">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--ink)]"
                  checked={d.include}
                  onChange={(e) => update(d.key, (x) => ({ ...x, include: e.target.checked }))}
                  aria-label={`Include ${d.name || "this food"}`}
                />
              </label>
              <div className="min-w-0 flex-1">
                <input
                  className="field h-10 border-transparent bg-transparent px-1.5 text-[16px] font-semibold hover:border-line-strong focus:border-ink"
                  value={d.name}
                  placeholder="Food name"
                  onChange={(e) => update(d.key, (x) => ({ ...x, name: e.target.value }))}
                  aria-label="Food name"
                />
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-1.5">
                  <MacroLine protein={d.protein} carbs={d.carbs} fat={d.fat} />
                  {lowConfidence && (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-2">
                      <Icon name="alert" size={13} strokeWidth={2.2} />
                      Check the portion
                    </span>
                  )}
                </div>
              </div>
              <button
                className="btn btn-quiet btn-icon btn-sm shrink-0"
                aria-label={`Remove ${d.name || "this food"}`}
                onClick={() => onChange(items.filter((x) => x.key !== d.key))}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_0.9fr_repeat(4,minmax(0,1fr))]">
              <Cell label="Portion" className="col-span-2 sm:col-span-1">
                <input
                  className="cell-input px-2 text-left text-[15px] font-medium"
                  value={d.portion}
                  placeholder="1 bowl"
                  onChange={(e) => update(d.key, (x) => ({ ...x, portion: e.target.value }))}
                />
              </Cell>
              <Cell label="Weight (g)">
                <input
                  className="cell-input"
                  inputMode="decimal"
                  value={d.grams ?? ""}
                  onChange={(e) => update(d.key, (x) => rescale(x, e.target.value === "" ? null : Number(e.target.value)))}
                />
              </Cell>
              <Cell label="kcal">
                <input className="cell-input" inputMode="decimal" value={d.calories} onChange={(e) => setMacro("calories", e.target.value)} />
              </Cell>
              <Cell label="Protein" dot="var(--protein)">
                <input className="cell-input" inputMode="decimal" value={d.protein} onChange={(e) => setMacro("protein", e.target.value)} />
              </Cell>
              <Cell label="Carbs" dot="var(--carbs)">
                <input className="cell-input" inputMode="decimal" value={d.carbs} onChange={(e) => setMacro("carbs", e.target.value)} />
              </Cell>
              <Cell label="Fat" dot="var(--fat)">
                <input className="cell-input" inputMode="decimal" value={d.fat} onChange={(e) => setMacro("fat", e.target.value)} />
              </Cell>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Cell({ label, dot, className = "", children }: { label: string; dot?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} aria-hidden />}
        {label}
      </span>
      {children}
    </label>
  );
}

export function DraftTotals({ items }: { items: Draft[] }) {
  const t = sumMacros(items.filter((i) => i.include));
  return (
    <div className="flex items-baseline gap-3">
      <span>
        <span className="condensed text-[30px] font-black leading-none">{fmt(t.calories)}</span>
        <span className="ml-1 text-[13px] font-semibold text-muted">kcal</span>
      </span>
      <MacroLine {...t} />
    </div>
  );
}
