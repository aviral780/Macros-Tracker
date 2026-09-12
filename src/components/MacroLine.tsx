import { fmt } from "@/lib/nutrition";

/** "P 32 · C 40 · F 12" with a plate-colour key beside each letter. Text stays in ink. */
export function MacroLine({ protein, carbs, fat, className = "" }: { protein: number; carbs: number; fat: number; className?: string }) {
  const item = (label: string, v: number, color: string) => (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      <span className="sr-only">{label === "P" ? "Protein" : label === "C" ? "Carbs" : "Fat"}</span>
      <span aria-hidden>{label}</span>
      <span className="tnum">{fmt(v)}</span>
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-2.5 text-[13px] text-ink-2 ${className}`}>
      {item("P", protein, "var(--protein)")}
      {item("C", carbs, "var(--carbs)")}
      {item("F", fat, "var(--fat)")}
    </span>
  );
}
