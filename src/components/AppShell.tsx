"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Icon, type IconName } from "./Icon";

const NAV: { href: string; label: string; icon: IconName; keepDate?: boolean }[] = [
  { href: "/", label: "Today", icon: "today", keepDate: true },
  { href: "/train", label: "Train", icon: "dumbbell", keepDate: true },
  { href: "/log", label: "Log food", icon: "camera", keepDate: true },
  { href: "/coach", label: "Coach", icon: "spark" },
  { href: "/trends", label: "Trends", icon: "chart" },
  { href: "/goals", label: "Goals", icon: "target" },
];

const SETTINGS = { href: "/settings", label: "Settings", icon: "settings" as IconName };

/** The sidebar keeps Settings pinned to the bottom; on a phone it has to live in the bar. */
const MOBILE_NAV = [...NAV, SETTINGS];

function useHref() {
  const params = useSearchParams();
  const date = params.get("date");
  return (item: (typeof NAV)[number]) => (item.keepDate && date ? `${item.href}?date=${date}` : item.href);
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function SideNav() {
  const pathname = usePathname();
  const hrefFor = useHref();
  return (
    <nav aria-label="Main" className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-panel px-4 py-6">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="grid h-8 w-8 place-items-center rounded-[7px] bg-ink">
          <span className="block h-1 w-4 bg-panel" />
        </span>
        <span className="condensed text-[26px] font-black leading-none">Macros</span>
      </Link>
      <ul className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={hrefFor(item)}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] font-semibold transition-colors ${
                  active ? "bg-ink text-panel" : "text-ink-2 hover:bg-panel-2 hover:text-ink"
                }`}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto">
        <Link
          href={SETTINGS.href}
          aria-current={pathname.startsWith(SETTINGS.href) ? "page" : undefined}
          className={`flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] font-semibold ${
            pathname.startsWith(SETTINGS.href) ? "bg-ink text-panel" : "text-ink-2 hover:bg-panel-2 hover:text-ink"
          }`}
        >
          <Icon name={SETTINGS.icon} />
          {SETTINGS.label}
        </Link>
      </div>
    </nav>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const hrefFor = useHref();
  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-7">
        {MOBILE_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const isLog = item.href === "/log";
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={hrefFor(item)}
                aria-current={active ? "page" : undefined}
                className={`flex h-[62px] flex-col items-center justify-center gap-1 px-0.5 text-[10px] font-semibold leading-none tracking-tight ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                {isLog ? (
                  <span className="-mt-0.5 grid h-9 w-9 place-items-center rounded-full bg-ink text-panel shadow-[var(--shadow)]">
                    <Icon name="camera" size={18} />
                  </span>
                ) : (
                  <Icon name={item.icon} size={20} strokeWidth={active ? 2.2 : 1.8} />
                )}
                <span className={isLog ? "sr-only" : "block w-full truncate text-center"}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <SideNav />
        <BottomNav />
      </Suspense>
      <main className="md:pl-60 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-12">
        <div className="mx-auto w-full max-w-[1120px] px-4 pt-[max(16px,env(safe-area-inset-top))] md:px-8 md:pt-8">{children}</div>
      </main>
    </>
  );
}
