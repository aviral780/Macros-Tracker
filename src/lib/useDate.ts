"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { isISODate, todayISO } from "./dates";

/** The day being viewed lives in the URL (?date=YYYY-MM-DD) so it survives navigation and reloads. */
export function useDate() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("date");
  const date = isISODate(raw) ? raw : todayISO();
  const setDate = useCallback(
    (d: string) => {
      const next = new URLSearchParams(params.toString());
      if (d === todayISO()) next.delete("date");
      else next.set("date", d);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return [date, setDate] as const;
}
