"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { round } from "@/lib/nutrition";
import { MEAL_LABEL, MEALS, type FoodEntry, type Meal } from "@/lib/types";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

type Form = { name: string; portion: string; grams: string; calories: string; protein: string; carbs: string; fat: string; meal: Meal };

const toForm = (e: FoodEntry): Form => ({
  name: e.name,
  portion: e.portion,
  grams: e.grams != null ? String(round(e.grams)) : "",
  calories: String(round(e.calories)),
  protein: String(round(e.protein, 1)),
  carbs: String(round(e.carbs, 1)),
  fat: String(round(e.fat, 1)),
  meal: e.meal,
});

type Props = { entry: FoodEntry | null; onClose: () => void; onChanged: () => void };

export function FoodEditSheet(props: Props) {
  if (!props.entry) return null;
  return <FoodEditForm key={props.entry.id} {...props} entry={props.entry} />;
}

function FoodEditForm({ entry, onClose, onChanged }: Props & { entry: FoodEntry }) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(entry));
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Form, v: string) => setForm({ ...form, [k]: v });

  // Changing the weight rescales every macro, the way a food scale would.
  const setGrams = (v: string) => {
    const g = parseFloat(v);
    const base = entry.grams ?? 0;
    if (base > 0 && g > 0) {
      const f = g / base;
      setForm({
        ...form,
        grams: v,
        calories: String(round(entry.calories * f)),
        protein: String(round(entry.protein * f, 1)),
        carbs: String(round(entry.carbs * f, 1)),
        fat: String(round(entry.fat * f, 1)),
      });
    } else set("grams", v);
  };

  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/foods/${entry.id}`, {
        method: "PATCH",
        body: { ...form, grams: form.grams === "" ? null : Number(form.grams) },
      });
      toast("Saved changes");
      onChanged();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/api/foods/${entry.id}`, { method: "DELETE" });
      onChanged();
      onClose();
      toast(`Deleted ${entry.name}`, {
        action: {
          label: "Undo",
          run: async () => {
            await api("/api/foods", {
              method: "POST",
              body: { date: entry.date, meal: entry.meal, source: entry.source, photoId: entry.photo_id, items: [entry] },
            });
            onChanged();
          },
        },
      });
    } finally {
      setBusy(false);
    }
  };

  const num = (k: keyof Form, label: string, unit: string, onChange = (v: string) => set(k, v)) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <span className="relative block">
        <input className="field tnum pr-10" inputMode="decimal" value={form[k]} onChange={(e) => onChange(e.target.value)} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
      </span>
    </label>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title="Edit food"
      footer={
        <>
          <button className="btn btn-ghost btn-danger" onClick={remove} disabled={busy}>
            Delete
          </button>
          <button className="btn btn-primary ml-auto" onClick={save} disabled={busy}>
            Save changes
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="block">
          <span className="field-label">Food</span>
          <input className="field" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="field-label">Portion</span>
            <input className="field" value={form.portion} placeholder="1 bowl" onChange={(e) => set("portion", e.target.value)} />
          </label>
          {num("grams", "Weight", "g", setGrams)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {num("calories", "Calories", "kcal")}
          {num("protein", "Protein", "g")}
          {num("carbs", "Carbs", "g")}
          {num("fat", "Fat", "g")}
        </div>
        <label className="block">
          <span className="field-label">Meal</span>
          <select className="field" value={form.meal} onChange={(e) => set("meal", e.target.value)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Sheet>
  );
}
