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

/** The Monday-to-Sunday week containing the given day. */
export function weekRange(s: string) {
  const mondayOffset = (parseISODate(s).getDay() + 6) % 7;
  const from = addDays(s, -mondayOffset);
  return { from, to: addDays(from, 6) };
}

export function isISODate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Names are spelled out here rather than via toLocaleDateString: Node and the browser
 * ship different CLDR data, so en-GB September renders "Sept" on the server and "Sep"
 * in Chromium, which breaks hydration.
 */
export function formatDay(s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  const d = parseISODate(s);
  const parts: string[] = [];
  if (opts.weekday) parts.push((opts.weekday === "long" ? WEEKDAYS_LONG : WEEKDAYS_SHORT)[d.getDay()]);
  if (opts.day) parts.push(String(d.getDate()));
  if (opts.month) parts.push((opts.month === "long" ? MONTHS_LONG : MONTHS_SHORT)[d.getMonth()]);
  if (opts.year) parts.push(String(d.getFullYear()));
  return parts.join(" ");
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
