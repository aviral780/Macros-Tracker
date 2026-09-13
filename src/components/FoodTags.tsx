import { foodTags } from "@/lib/foodTags";
import type { Macros } from "@/lib/types";

const TONE: Record<string, string> = {
  good: "border-train/40 text-train",
  neutral: "border-line-strong text-ink-2",
  warn: "border-fat/50 text-fat",
};

/** Derived straight from the macros, so these render with no model call. */
export function FoodTags({
  item,
  max = 3,
  className = "",
}: {
  item: Macros & { fiber?: number; grams?: number | null };
  max?: number;
  className?: string;
}) {
  const tags = foodTags(item).slice(0, max);
  if (tags.length === 0) return null;
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`}>
      {tags.map((t) => (
        <span
          key={t.label}
          className={`rounded-full border px-1.5 py-px text-[11px] font-semibold leading-tight ${TONE[t.tone]}`}
        >
          {t.label}
        </span>
      ))}
    </span>
  );
}
