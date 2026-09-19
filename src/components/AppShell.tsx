"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";

type NavItem = { href: string; label: string; icon: IconName; keepDate?: boolean };

/** The five that earn a permanent slot on a phone. */
const PRIMARY: NavItem[] = [
  { href: "/", label: "Today", icon: "today", keepDate: true },
  { href: "/train", label: "Train", icon: "dumbbell", keepDate: true },
  { href: "/log", label: "Log food", icon: "camera", keepDate: true },
  { href: "/coach", label: "Coach", icon: "spark" },
  { href: "/trends", label: "Trends", icon: "chart" },
];

/** Set-and-forget screens: in the sidebar on desktop, behind the menu on a phone. */
const SECONDARY: NavItem[] = [
  { href: "/goals", label: "Goals", icon: "target" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const ALL = [...PRIMARY, ...SECONDARY];

function useHref() {
  const params = useSearchParams();
  const date = params.get("date");
  return (item: NavItem) => (item.keepDate && date ? `${item.href}?date=${date}` : item.href);
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function SideNav() {
  const pathname = usePathname();
  const hrefFor = useHref();
  const settings = SECONDARY[SECONDARY.length - 1];
  return (
    <nav aria-label="Main" className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-panel px-4 py-6">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="grid h-8 w-8 place-items-center rounded-[7px] bg-ink">
          <span className="block h-1 w-4 bg-panel" />
        </span>
        <span className="condensed text-[26px] font-black leading-none">Macros</span>
      </Link>
      <ul className="flex flex-col gap-1">
        {[...PRIMARY, SECONDARY[0]].map((item) => {
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
          href={settings.href}
          aria-current={isActive(pathname, settings.href) ? "page" : undefined}
          className={`flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] font-semibold ${
            isActive(pathname, settings.href) ? "bg-ink text-panel" : "text-ink-2 hover:bg-panel-2 hover:text-ink"
          }`}
        >
          <Icon name={settings.icon} />
          {settings.label}
        </Link>
      </div>
    </nav>
  );
}

function MobileTopBar() {
  const pathname = usePathname();
  const hrefFor = useHref();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div
        className="md:hidden sticky top-0 z-50 border-b border-line bg-panel/95 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-ink">
              <span className="block h-[3px] w-3.5 bg-panel" />
            </span>
            <span className="condensed text-[21px] font-black leading-none">Macros</span>
          </Link>

          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-[10px] text-ink-2 hover:bg-panel-2 hover:text-ink"
          >
            <span className="grid gap-[5px]">
              <span className="block h-[2px] w-[18px] rounded-full bg-current" />
              <span className="block h-[2px] w-[18px] rounded-full bg-current" />
              <span className="block h-[2px] w-[18px] rounded-full bg-current" />
            </span>
          </button>
        </div>
      </div>

      {/* Its own layer: the bar's backdrop-blur would otherwise trap this inside the bar. */}
      {open && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 cursor-default bg-ink/20"
            onClick={() => setOpen(false)}
          />
          <nav
            aria-label="All sections"
            className="absolute right-3 w-56 overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow)]"
            style={{ top: "calc(env(safe-area-inset-top) + 60px)" }}
          >
            <ul className="p-1.5">
              {ALL.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={hrefFor(item)}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold ${
                        active ? "bg-ink text-panel" : "text-ink-2 hover:bg-panel-2 hover:text-ink"
                      }`}
                    >
                      <Icon name={item.icon} size={19} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </>
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
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {PRIMARY.map((item) => {
          const active = isActive(pathname, item.href);
          const isLog = item.href === "/log";
          return (
            <li key={item.href}>
              <Link
                href={hrefFor(item)}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                {isLog ? (
                  // Lifted out of the bar and ringed in the page colour so the primary
                  // action reads as a button, not a sixth tab.
                  <span className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-ink text-panel ring-4 ring-page shadow-[var(--shadow)]">
                    <Icon name="camera" size={24} />
                  </span>
                ) : (
                  <Icon name={item.icon} size={23} strokeWidth={active ? 2.2 : 1.8} />
                )}
                <span className={isLog ? "sr-only" : ""}>{item.label}</span>
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
        <MobileTopBar />
        <BottomNav />
      </Suspense>
      <main className="md:pl-60 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-12">
        <div className="mx-auto w-full max-w-[1120px] px-4 pt-5 md:px-8 md:pt-8">{children}</div>
      </main>
    </>
  );
}
