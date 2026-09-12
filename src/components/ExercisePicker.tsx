"use client";

import { useMemo, useState } from "react";
import { useData } from "@/lib/client";
import type { Exercise } from "@/lib/types";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

const MUSCLES = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Other"];

export function ExercisePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (p: { exerciseId: number } | { name: string; muscle: string }) => void;
}) {
  const { data } = useData<{ exercises: Exercise[] }>(open ? "/api/exercises" : null);
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("Other");

  const term = q.trim().toLowerCase();
  const list = useMemo(() => {
    const all = data?.exercises ?? [];
    return term ? all.filter((e) => e.name.toLowerCase().includes(term) || e.muscle.toLowerCase().includes(term)) : all;
  }, [data, term]);

  // The API returns most-used first, so regulars fall out of the data with no curation.
  const regulars = useMemo(() => (term ? [] : list.filter((e) => e.uses > 0).slice(0, 8)), [list, term]);
  const rest = useMemo(() => {
    const skip = new Set(regulars.map((e) => e.id));
    const others = list.filter((e) => !skip.has(e.id));
    return term ? others : [...others].sort((a, b) => a.muscle.localeCompare(b.muscle) || a.name.localeCompare(b.name));
  }, [list, regulars, term]);

  const exact = list.some((e) => e.name.toLowerCase() === term);

  const pick = (p: Parameters<typeof onPick>[0]) => {
    onPick(p);
    setQ("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add exercise">
      <input
        className="field"
        placeholder="Search or name a new exercise"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search exercises"
        autoFocus
      />
      {q.trim() && !exact && (
        <div className="mt-3 rounded-xl border border-line p-3">
          <p className="text-[14px]">
            Create <span className="font-semibold">&ldquo;{q.trim()}&rdquo;</span>
          </p>
          <div className="mt-2 flex gap-2">
            <select className="field h-10 flex-1" value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="Muscle group">
              {MUSCLES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <button className="btn btn-primary h-10" onClick={() => pick({ name: q.trim(), muscle })}>
              Create and add
            </button>
          </div>
        </div>
      )}
      {regulars.length > 0 && (
        <>
          <p className="field-label mt-4">Your regulars</p>
          <ul className="-mx-2">
            {regulars.map((e) => (
              <li key={e.id}>
                <button
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-panel-2"
                  onClick={() => pick({ exerciseId: e.id })}
                >
                  <span className="flex-1 text-[15px] font-semibold">{e.name}</span>
                  <span className="text-[12px] text-muted tnum">{e.uses}×</span>
                  <Icon name="plus" size={16} className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
          <p className="field-label mt-4">Everything else</p>
        </>
      )}
      <ul className={regulars.length > 0 ? "-mx-2" : "mt-3 -mx-2"}>
        {rest.map((e) => (
          <li key={e.id}>
            <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-panel-2" onClick={() => pick({ exerciseId: e.id })}>
              <span className="flex-1 text-[15px] font-medium">{e.name}</span>
              <span className="text-[12px] text-muted">{e.muscle}</span>
              <Icon name="plus" size={16} className="text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
