/** Dates are stored as local calendar days: "YYYY-MM-DD". */
export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number) {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function isISODate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function formatDay(s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return parseISODate(s).toLocaleDateString("en-GB", opts);
}

export function relativeDayLabel(s: string) {
  const today = todayISO();
  if (s === today) return "Today";
  if (s === addDays(today, -1)) return "Yesterday";
  if (s === addDays(today, 1)) return "Tomorrow";
  return formatDay(s);
}

export function mealForNow(): "breakfast" | "lunch" | "dinner" | "snack" {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h >= 18 && h < 23) return "dinner";
  return "snack";
}
