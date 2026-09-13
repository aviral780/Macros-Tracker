"use client";

import { useState } from "react";
import { api, useData } from "@/lib/client";
import { fmt } from "@/lib/nutrition";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

type Suggestion = { name: string; why: string; calories: number; protein: number };
type Taste = {
  ready: boolean;
  days?: number;
  entries?: number;
  needed?: number;
  model?: string;
  payload?: { summary: string; likes: string[]; strengths: string[]; gaps: string[]; suggestions: Suggestion[] };
};
type PlanItem = { name: string; portion: string; calories: number; protein: number; carbs: number; fat: number };
type Plan = {
  ready: boolean;
  entries?: number;
  needed?: number;
  model?: string;
  target?: { calories: number; protein: number };
  payload?: {
    summary: string;
    meals: { meal: string; items: PlanItem[] }[];
    totals: { calories: number; protein: number; carbs: number; fat: number };
  };
};

export function CoachView() {
  const toast = useToast();
  const taste = useData<Taste>("/api/insights/taste");
  const plan = useData<Plan>("/api/insights/plan");
  const [busy, setBusy] = useState("");

  const refresh = async (what: "taste" | "plan") => {
    setBusy(what);
    try {
      await api(`/api/insights/${what}?refresh=1`);
      await (what === "taste" ? taste.reload() : plan.reload());
      toast(what === "taste" ? "Taste profile rebuilt" : "New day built");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't refresh", { tone: "error" });
    } finally {
      setBusy("");
    }
  };

  const t = taste.data;
  const p = plan.data;

  return (
    <div className="animate-fade">
      <header className="mb-5">
        <p className="eyebrow">Learned from your log</p>
        <h1 className="condensed text-[34px] font-black leading-tight">Coach</h1>
      </header>

      {taste.error && (
        <div className="panel mb-4 flex items-start gap-3 border-critical/40 p-4 text-sm">
          <Icon name="alert" className="mt-0.5 shrink-0 text-critical" />
          <span>{taste.error}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <section className="panel overflow-hidden">
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold">Your taste</h2>
              {t?.days !== undefined && <p className="text-[12px] text-muted">Read from {t.days} days of logging</p>}
            </div>
            <button className="btn btn-quiet btn-sm" disabled={busy === "taste"} onClick={() => refresh("taste")}>
              {busy === "taste" ? "Reading…" : "Rebuild"}
            </button>
          </header>

          {taste.loading && !t ? (
            <div className="h-40 animate-pulse" />
          ) : t && !t.ready ? (
            <p className="px-4 py-4 text-[14px] text-muted">
              Log a few more meals first — {t.entries ?? 0} of {t.needed ?? 5} distinct foods so far.
            </p>
          ) : t?.payload ? (
            <div className="px-4 py-3">
              <p className="text-[14px] text-ink-2">{t.payload.summary}</p>

              <Block title="What you reach for" items={t.payload.likes} icon="check" tone="text-train" />
              <Block title="Already working" items={t.payload.strengths} icon="check" tone="text-train" />
              <Block title="Where it falls short" items={t.payload.gaps} icon="alert" tone="text-fat" />

              {t.payload.suggestions.length > 0 && (
                <>
                  <p className="field-label mt-4">Try these — they fit what you already eat</p>
                  <ul className="grid gap-2">
                    {t.payload.suggestions.map((s) => (
                      <li key={s.name} className="rounded-xl border border-line p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[15px] font-semibold">{s.name}</span>
                          <span className="shrink-0 text-[12px] text-muted tnum">
                            {fmt(s.calories)} kcal · {fmt(s.protein)} g P
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] text-ink-2">{s.why}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {t.model && <p className="mt-3 text-[11px] text-muted">Read by {t.model}</p>}
            </div>
          ) : null}
        </section>

        <section className="panel overflow-hidden">
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold">A day that hits your targets</h2>
              <p className="text-[12px] text-muted">Built from foods you actually eat</p>
            </div>
            <button className="btn btn-quiet btn-sm" disabled={busy === "plan"} onClick={() => refresh("plan")}>
              {busy === "plan" ? "Building…" : "Rebuild"}
            </button>
          </header>

          {plan.loading && !p ? (
            <div className="h-40 animate-pulse" />
          ) : p && !p.ready ? (
            <p className="px-4 py-4 text-[14px] text-muted">
              Log a few more meals first — {p.entries ?? 0} of {p.needed ?? 5} distinct foods so far.
            </p>
          ) : p?.payload ? (
            <div>
              <p className="px-4 pt-3 text-[14px] text-ink-2">{p.payload.summary}</p>
              {p.target && <TargetCheck totals={p.payload.totals} target={p.target} />}
              <dl className="mt-3 grid grid-cols-4 border-y border-line text-center">
                {[
                  ["kcal", p.payload.totals.calories],
                  ["Protein", `${fmt(p.payload.totals.protein)}g`],
                  ["Carbs", `${fmt(p.payload.totals.carbs)}g`],
                  ["Fat", `${fmt(p.payload.totals.fat)}g`],
                ].map(([k, v]) => (
                  <div key={k} className="border-r border-line py-2 last:border-r-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
                    <dd className="text-[16px] font-bold tnum">{typeof v === "number" ? fmt(v) : v}</dd>
                  </div>
                ))}
              </dl>
              {p.payload.meals.map((m) => (
                <div key={m.meal} className="border-b border-line last:border-b-0">
                  <p className="px-4 pt-2.5 text-[12px] font-bold uppercase tracking-wide text-muted">{m.meal}</p>
                  <ul className="px-4 pb-2.5">
                    {m.items.map((i) => (
                      <li key={i.name} className="flex items-baseline justify-between gap-3 py-1">
                        <span className="min-w-0">
                          <span className="text-[14px] font-medium">{i.name}</span>
                          {i.portion && <span className="text-[13px] text-muted"> · {i.portion}</span>}
                        </span>
                        <span className="shrink-0 text-[13px] text-muted tnum">
                          {fmt(i.calories)} kcal · {fmt(i.protein)}P
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {p.model && <p className="px-4 py-2 text-[11px] text-muted">Built by {p.model}</p>}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Block({ title, items, icon, tone }: { title: string; items: string[]; icon: "check" | "alert"; tone: string }) {
  if (items.length === 0) return null;
  return (
    <>
      <p className="field-label mt-4">{title}</p>
      <ul className="grid gap-1.5">
        {items.map((line) => (
          <li key={line} className="flex gap-2 text-[14px] text-ink-2">
            <Icon name={icon} size={15} className={`mt-0.5 shrink-0 ${tone}`} />
            {line}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Says plainly when the plan misses, and why. A calorie goal that is lower than the
 * macro targets themselves is unsatisfiable by any plan, so name that rather than
 * quietly shipping a day that is hundreds of calories over.
 */
function TargetCheck({
  totals,
  target,
}: {
  totals: { calories: number; protein: number };
  target: { calories: number; protein: number };
}) {
  const overCalories = totals.calories - target.calories;
  const shortProtein = target.protein - totals.protein;
  const missesCalories = Math.abs(overCalories) > target.calories * 0.05;
  const missesProtein = shortProtein > target.protein * 0.05;
  if (!missesCalories && !missesProtein) {
    return (
      <p className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-panel-2 px-3 py-2 text-[13px] text-train">
        <Icon name="check" size={15} className="shrink-0" />
        Lands on both your calorie and protein targets.
      </p>
    );
  }
  return (
    <p className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-panel-2 px-3 py-2 text-[13px] text-ink-2">
      <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-fat" />
      <span>
        {missesCalories && (
          <>
            {overCalories > 0 ? `${fmt(overCalories)} kcal over` : `${fmt(-overCalories)} kcal under`} your{" "}
            {fmt(target.calories)} target
            {missesProtein ? ", and " : ". "}
          </>
        )}
        {missesProtein && `${fmt(shortProtein)} g short of ${fmt(target.protein)} g protein. `}
        Your macro targets add up to more calories than your calorie goal, so no day can hit both — worth fixing on
        the Goals page.
      </span>
    </p>
  );
}
