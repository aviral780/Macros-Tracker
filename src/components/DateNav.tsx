"use client";

import { addDays, formatDay, relativeDayLabel, todayISO } from "@/lib/dates";
import { Icon } from "./Icon";

export function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const isToday = date === todayISO();
  return (
    <div className="flex items-center gap-1">
      <button className="btn btn-quiet btn-icon btn-sm" aria-label="Previous day" onClick={() => onChange(addDays(date, -1))}>
        <Icon name="left" size={18} />
      </button>
      <label className="relative">
        <span className="sr-only">Pick a date</span>
        <span className="btn btn-quiet btn-sm min-w-[124px] pointer-events-none">
          {relativeDayLabel(date)}
          {isToday || relativeDayLabel(date) !== formatDay(date) ? (
            <span className="font-normal text-muted">{formatDay(date, { day: "numeric", month: "short" })}</span>
          ) : null}
        </span>
        <input
          type="date"
          value={date}
          max={addDays(todayISO(), 1)}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <button className="btn btn-quiet btn-icon btn-sm" aria-label="Next day" onClick={() => onChange(addDays(date, 1))}>
        <Icon name="right" size={18} />
      </button>
      {!isToday && (
        <button className="btn btn-ghost btn-sm ml-1" onClick={() => onChange(todayISO())}>
          Today
        </button>
      )}
    </div>
  );
}
