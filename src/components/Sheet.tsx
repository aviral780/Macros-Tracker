"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

/** Bottom sheet on phones, centred dialog on larger screens. Built on <dialog> for focus trapping and Esc. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-[2px] md:m-auto md:max-w-lg"
    >
      {open && (
        <div className="animate-rise flex max-h-[88dvh] flex-col rounded-t-2xl border border-line bg-panel text-ink shadow-[var(--shadow)] md:rounded-2xl">
          <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="semi-condensed text-lg font-bold">{title}</h2>
            <button className="btn btn-quiet btn-icon btn-sm" onClick={onClose} aria-label="Close">
              <Icon name="x" size={18} />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <footer className="flex gap-2 border-t border-line px-5 py-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
