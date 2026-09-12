"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, useData } from "@/lib/client";
import { mealForNow, relativeDayLabel, todayISO } from "@/lib/dates";
import { photoToDataUrl } from "@/lib/image";
import { fmt } from "@/lib/nutrition";
import { useDate } from "@/lib/useDate";
import { MEAL_LABEL, MEALS, type FoodEntry, type Meal } from "@/lib/types";
import { Icon, type IconName } from "./Icon";
import { MacroLine } from "./MacroLine";
import { DraftTotals, makeDraft, ReviewList, type Draft } from "./ReviewList";
import { useToast } from "./Toast";

type Mode = "photo" | "describe" | "manual" | "recent";
const MODES: { id: Mode; label: string; icon: IconName }[] = [
  { id: "photo", label: "Photo", icon: "camera" },
  { id: "describe", label: "Describe", icon: "text" },
  { id: "manual", label: "Manual", icon: "pencil" },
  { id: "recent", label: "Recent", icon: "clock" },
];

type Analysis = {
  title: string;
  notes: string;
  model: string;
  photoId: string | null;
  items: { name: string; portion: string; grams: number; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; confidence: number }[];
};

export function LogView() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [date] = useDate();

  const initialMeal = params.get("meal");
  const [meal, setMeal] = useState<Meal>(MEALS.includes(initialMeal as Meal) ? (initialMeal as Meal) : mealForNow());
  const initialMode = params.get("mode");
  const [mode, setMode] = useState<Mode>(MODES.some((m) => m.id === initialMode) ? (initialMode as Mode) : "photo");

  const [photo, setPhoto] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string; notes: string; model: string } | null>(null);
  const [items, setItems] = useState<Draft[]>([]);
  const [source, setSource] = useState<"photo" | "text" | "manual" | "recent">("photo");
  const [saving, setSaving] = useState(false);

  const included = items.filter((i) => i.include);

  const reset = () => {
    setPhoto(null);
    setPhotoId(null);
    setNote("");
    setResult(null);
    setItems([]);
    setError(null);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    if (m === "manual" && items.length === 0) {
      setSource("manual");
      setItems([makeDraft({ name: "" })]);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    reset();
    try {
      setPhoto(await photoToDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that photo");
    }
  };

  // Paste a photo from the clipboard on desktop.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (mode !== "photo") return;
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) onFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const analyze = async (kind: "photo" | "text") => {
    setAnalyzing(true);
    setError(null);
    try {
      const body =
        kind === "photo"
          ? photoId
            ? { photoId, text: note }
            : { image: photo, text: note }
          : { text: description };
      const r = await api<Analysis>("/api/analyze", { method: "POST", body });
      if (r.photoId) setPhotoId(r.photoId);
      setResult({ title: r.title, notes: r.notes, model: r.model });
      setSource(kind);
      setItems(
        r.items.map((i) =>
          makeDraft({
            name: i.name,
            portion: i.portion,
            grams: i.grams || null,
            calories: Math.round(i.calories),
            protein: Math.round(i.protein_g * 10) / 10,
            carbs: Math.round(i.carbs_g * 10) / 10,
            fat: Math.round(i.fat_g * 10) / 10,
            fiber: Math.round(i.fiber_g * 10) / 10,
            confidence: i.confidence,
          }),
        ),
      );
      if (r.items.length === 0) setError(r.notes || "No food found. Try a clearer photo or describe it instead.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    const valid = included.filter((i) => i.name.trim());
    if (valid.length === 0) {
      toast("Give each food a name before logging", { tone: "error" });
      return;
    }
    setSaving(true);
    try {
      await api("/api/foods", {
        method: "POST",
        body: { date, meal, source, photoId: source === "photo" ? photoId : null, items: valid },
      });
      toast(`Logged to ${MEAL_LABEL[meal]}`);
      router.push(date === todayISO() ? "/" : `/?date=${date}`);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", { tone: "error" });
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade mx-auto max-w-3xl">
      <header className="mb-5">
        <p className="eyebrow">{relativeDayLabel(date)}</p>
        <h1 className="condensed text-[34px] font-black leading-tight">Log food</h1>
      </header>

      <div className="mb-5 grid gap-3">
        <div>
          <span className="field-label" id="meal-label">
            Meal
          </span>
          <div className="segmented w-full" role="group" aria-labelledby="meal-label">
            {MEALS.map((m) => (
              <button key={m} aria-pressed={meal === m} onClick={() => setMeal(m)} className="flex-1">
                {MEAL_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="segmented w-full" role="group" aria-label="How to log">
          {MODES.map((m) => (
            <button key={m.id} aria-pressed={mode === m.id} onClick={() => switchMode(m.id)} className="flex flex-1 items-center justify-center gap-1.5">
              <Icon name={m.icon} size={16} />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "photo" && (
        <PhotoPanel
          photo={photo}
          analyzing={analyzing}
          note={note}
          setNote={setNote}
          hasResult={!!result && source === "photo"}
          onFile={onFile}
          onClear={reset}
          onAnalyze={() => analyze("photo")}
        />
      )}

      {mode === "describe" && (
        <section className="panel p-4">
          <label className="block">
            <span className="field-label">What did you eat?</span>
            <textarea
              className="field min-h-[110px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="3 egg omelette cooked in butter, 2 slices of brown bread, a glass of milk"
            />
          </label>
          <p className="mt-2 text-[13px] text-muted">Include amounts and cooking fats when you know them. Brand names help for packaged food.</p>
          <button className="btn btn-primary mt-3 w-full sm:w-auto" onClick={() => analyze("text")} disabled={analyzing || !description.trim()}>
            <Icon name="spark" size={18} />
            {analyzing ? "Estimating…" : "Estimate macros"}
          </button>
        </section>
      )}

      {mode === "recent" && (
        <RecentPicker
          onPick={(f) => {
            setSource("recent");
            setItems((cur) => [
              ...cur,
              makeDraft({ name: f.name, portion: f.portion, grams: f.grams, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber }),
            ]);
          }}
        />
      )}

      {error && (
        <div role="alert" className="panel mt-4 flex items-start gap-3 p-4 text-[14px]">
          <Icon name="alert" className="mt-0.5 shrink-0 text-critical" />
          <div className="flex-1">
            <p>{error}</p>
            {/Settings/.test(error) && (
              <Link href="/settings" className="mt-2 inline-block font-semibold underline underline-offset-2">
                Open Settings
              </Link>
            )}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <section className="mt-6" aria-label="Review">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">{source === "photo" || source === "text" ? "Review the estimate" : "Foods to log"}</p>
              <h2 className="semi-condensed text-[22px] font-bold leading-tight">{result?.title || MEAL_LABEL[meal]}</h2>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setItems([...items, makeDraft({ name: "" })])}>
              <Icon name="plus" size={16} />
              Add food
            </button>
          </div>
          {result?.notes && (source === "photo" || source === "text") && (
            <p className="mb-3 rounded-xl bg-panel-2 px-4 py-3 text-[14px] leading-relaxed text-ink-2">
              {result.notes} <span className="text-muted">· Estimated by {result.model}</span>
            </p>
          )}
          <ReviewList items={items} onChange={setItems} />

          <div
            className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel/95 p-3 pl-4 shadow-[var(--shadow)] backdrop-blur md:bottom-4"
          >
            <DraftTotals items={items} />
            <button className="btn btn-primary ml-auto" onClick={save} disabled={saving || included.length === 0}>
              <Icon name="check" size={18} />
              {saving ? "Logging…" : `Log to ${MEAL_LABEL[meal]}`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function PhotoPanel(props: {
  photo: string | null;
  analyzing: boolean;
  note: string;
  setNote: (s: string) => void;
  hasResult: boolean;
  onFile: (f: File | undefined) => void;
  onClear: () => void;
  onAnalyze: () => void;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  if (!props.photo) {
    return (
      <section
        className={`panel grid place-items-center border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? "border-ink bg-panel-2" : "border-line-strong"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          props.onFile(e.dataTransfer.files[0]);
        }}
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-panel-2">
          <Icon name="camera" size={26} />
        </span>
        <h2 className="semi-condensed mt-4 text-[20px] font-bold">Photograph your plate</h2>
        <p className="mt-1 max-w-sm text-[14px] text-ink-2">
          Shoot from above with the whole plate in frame. A fork or your hand in the shot helps with portion size.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button className="btn btn-primary" onClick={() => camRef.current?.click()}>
            <Icon name="camera" size={18} />
            Take photo
          </button>
          <button className="btn btn-ghost" onClick={() => libRef.current?.click()}>
            <Icon name="image" size={18} />
            Choose photo
          </button>
        </div>
        <p className="mt-4 hidden text-[13px] text-muted md:block">You can also drop or paste an image here.</p>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => props.onFile(e.target.files?.[0])} />
        <input ref={libRef} type="file" accept="image/*" hidden onChange={(e) => props.onFile(e.target.files?.[0])} />
      </section>
    );
  }

  return (
    <section className="panel overflow-hidden">
      <div className="relative bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={props.photo} alt="Your meal" className={`mx-auto max-h-[340px] w-full object-contain transition-opacity ${props.analyzing ? "opacity-70" : ""}`} />
        {props.analyzing && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="relative h-full w-full" style={{ animation: "scan 1.6s cubic-bezier(0.45,0,0.55,1) infinite alternate" }}>
              <div className="absolute inset-x-0 top-1/2 h-[2px] bg-white shadow-[0_0_24px_6px_rgba(255,255,255,0.55)]" />
            </div>
          </div>
        )}
        <button className="btn btn-quiet btn-sm absolute right-3 top-3 bg-panel/90" onClick={props.onClear} disabled={props.analyzing}>
          <Icon name="x" size={16} />
          Change photo
        </button>
      </div>
      <div className="p-4">
        <label className="block">
          <span className="field-label">Anything the photo can&apos;t show? (optional)</span>
          <input
            className="field"
            value={props.note}
            onChange={(e) => props.setNote(e.target.value)}
            placeholder="Cooked in ghee · 2 rotis under the curry · ate half"
          />
        </label>
        <button className="btn btn-primary mt-3 w-full sm:w-auto" onClick={props.onAnalyze} disabled={props.analyzing}>
          <Icon name="spark" size={18} />
          {props.analyzing ? "Identifying foods and portions…" : props.hasResult ? "Re-analyze with note" : "Analyze photo"}
        </button>
      </div>
    </section>
  );
}

function RecentPicker({ onPick }: { onPick: (f: FoodEntry) => void }) {
  const { data, loading } = useData<{ foods: FoodEntry[] }>("/api/foods/recent");
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<Set<number>>(new Set());
  const foods = useMemo(() => (data?.foods ?? []).filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())), [data, q]);

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-line p-3">
        <input className="field" placeholder="Search foods you've logged" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recent foods" />
      </div>
      {loading && !data ? (
        <p className="p-4 text-[14px] text-muted">Loading…</p>
      ) : foods.length === 0 ? (
        <p className="p-4 text-[14px] text-muted">
          {data?.foods.length ? "No match. Try another word." : "Foods you log appear here so you can add them again in one tap."}
        </p>
      ) : (
        <ul className="max-h-[420px] overflow-y-auto">
          {foods.map((f) => (
            <li key={f.id} className="border-b border-line last:border-b-0">
              <button
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-panel-2"
                onClick={() => {
                  onPick(f);
                  setAdded(new Set(added).add(f.id));
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{f.name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                    <span>{[f.portion, f.grams ? `${fmt(f.grams)} g` : ""].filter(Boolean).join(" · ")}</span>
                    <MacroLine protein={f.protein} carbs={f.carbs} fat={f.fat} />
                  </span>
                </span>
                <span className="text-[15px] font-semibold tnum">{fmt(f.calories)}</span>
                <span className={`grid h-8 w-8 place-items-center rounded-full ${added.has(f.id) ? "bg-ink text-panel" : "bg-panel-2"}`}>
                  <Icon name={added.has(f.id) ? "check" : "plus"} size={16} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
