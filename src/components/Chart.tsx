"use client";

import { useEffect, useId, useRef, useState } from "react";

export type Series = { key: string; label: string; color: string };
export type Datum = { x: string; label: string; values: Record<string, number | null> };
type Reference = { value: number; label: string };

const PAD = { top: 12, right: 12, bottom: 26, left: 44 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceStep(range: number, count: number) {
  const raw = range / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

function scaleY(min: number, max: number, zero: boolean, ticks = 4) {
  let lo = zero ? 0 : min;
  let hi = max;
  if (hi === lo) {
    hi = lo + (zero ? 1 : 2);
    if (!zero) lo -= 2;
  }
  const step = niceStep(hi - lo, ticks);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 1000; v += step) out.push(Math.round(v * 1000) / 1000);
  return { lo, hi, ticks: out };
}

const defaultFormat = (v: number) => Math.round(v).toLocaleString("en-US");

type Props = {
  title: string;
  data: Datum[];
  series: Series[];
  kind: "bar" | "line";
  reference?: Reference;
  height?: number;
  unit?: string;
  format?: (v: number) => string;
  zeroBaseline?: boolean;
  connectGaps?: boolean;
  emptyLabel?: string;
};

export function Chart({
  title,
  data,
  series,
  kind,
  reference,
  height = 220,
  unit = "",
  format = defaultFormat,
  zeroBaseline = kind === "bar",
  connectGaps = false,
  emptyLabel = "Not logged",
}: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  const stacked = kind === "bar";
  const totals = data.map((d) => {
    const vals = series.map((s) => d.values[s.key]).filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return stacked ? vals.reduce((a, b) => a + b, 0) : Math.max(...vals);
  });
  const mins = data.flatMap((d) => series.map((s) => d.values[s.key]).filter((v): v is number => v != null));
  const present = totals.filter((t): t is number => t != null);
  const maxV = Math.max(...present, reference?.value ?? 0, 0);
  const minV = Math.min(...(stacked ? present : mins), reference?.value ?? Infinity);
  const y = scaleY(Number.isFinite(minV) ? minV : 0, maxV, zeroBaseline);

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const n = data.length;
  const band = n > 0 ? innerW / n : innerW;
  const xAt = (i: number) => PAD.left + band * i + band / 2;
  const yAt = (v: number) => PAD.top + innerH - ((v - y.lo) / (y.hi - y.lo || 1)) * innerH;

  // Thin out x labels so they never collide (~48px per label).
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / 48))));
  const barW = Math.min(24, Math.max(3, band - 2));

  const hasData = present.length > 0;

  const onKey = (e: React.KeyboardEvent) => {
    if (!n) return;
    if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const pointerIndex = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left - PAD.left;
    return Math.max(0, Math.min(n - 1, Math.floor(px / band)));
  };

  const linePath = (key: string) => {
    let d = "";
    let pen = false;
    data.forEach((row, i) => {
      const v = row.values[key];
      if (v == null) {
        if (!connectGaps) pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const tip = active != null ? data[active] : null;
  const tipLeft = active != null ? Math.min(Math.max(xAt(active), 90), Math.max(90, width - 90)) : 0;

  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-bold">{title}</span>
        {series.length > 1 && (
          <span className="flex flex-wrap items-center gap-3 text-[12px] text-ink-2">
            {series.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                {kind === "bar" ? (
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
                ) : (
                  <span className="h-[2px] w-3.5 rounded" style={{ background: s.color }} />
                )}
                {s.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div
        ref={ref}
        className="relative outline-none"
        tabIndex={hasData ? 0 : -1}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        aria-label={`${title}. Use left and right arrow keys to read values.`}
        role="group"
      >
        {width > 0 && (
          <svg width={width} height={height} className="block overflow-visible" aria-hidden>
            {y.ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--line)" strokeWidth={1} />
                <text x={PAD.left - 8} y={yAt(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tnum">
                  {format(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % every === 0 ? (
                <text key={d.x} x={xAt(i)} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
                  {d.label}
                </text>
              ) : null,
            )}

            {active != null && kind === "line" && (
              <line x1={xAt(active)} x2={xAt(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--line-strong)" strokeWidth={1} />
            )}

            {kind === "bar" &&
              data.map((d, i) => {
                let base = yAt(Math.max(0, y.lo));
                const segs = series
                  .map((s) => ({ s, v: d.values[s.key] ?? 0 }))
                  .filter((x) => x.v > 0);
                return (
                  <g key={d.x} opacity={active != null && active !== i ? 0.55 : 1}>
                    {segs.map(({ s, v }, j) => {
                      const segH = Math.max(0, (v / (y.hi - y.lo || 1)) * innerH);
                      const top = base - segH;
                      const gap = j > 0 ? 2 : 0;
                      const isTop = j === segs.length - 1;
                      const x0 = xAt(i) - barW / 2;
                      const hh = Math.max(0, segH - gap);
                      base = top;
                      if (!isTop || hh < 5) return <rect key={s.key} x={x0} y={top} width={barW} height={hh} fill={s.color} />;
                      const r = 4;
                      return (
                        <path
                          key={s.key}
                          fill={s.color}
                          d={`M${x0},${top + hh}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + barW - r}Q${x0 + barW},${top} ${x0 + barW},${top + r}V${top + hh}Z`}
                        />
                      );
                    })}
                  </g>
                );
              })}

            {kind === "line" &&
              series.map((s) => (
                <g key={s.key}>
                  <path d={linePath(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {data.map((d, i) => {
                    const v = d.values[s.key];
                    if (v == null) return null;
                    const isolated = !connectGaps && data[i - 1]?.values[s.key] == null && data[i + 1]?.values[s.key] == null;
                    const show = active === i || isolated || n <= 16;
                    return show ? (
                      <circle key={d.x} cx={xAt(i)} cy={yAt(v)} r={active === i ? 5 : 3.5} fill={s.color} stroke="var(--panel)" strokeWidth={2} />
                    ) : null;
                  })}
                </g>
              ))}

            {reference && reference.value > 0 && (
              <g>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={yAt(reference.value)}
                  y2={yAt(reference.value)}
                  stroke="var(--ink)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                <text x={width - PAD.right} y={yAt(reference.value) - 6} textAnchor="end" fontSize={11} fontWeight={700} fill="var(--ink)">
                  {reference.label}
                </text>
              </g>
            )}

            <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="var(--line-strong)" strokeWidth={1} />

            <rect
              x={PAD.left}
              y={PAD.top}
              width={innerW}
              height={innerH}
              fill="transparent"
              onPointerMove={(e) => setActive(pointerIndex(e))}
              onPointerDown={(e) => setActive(pointerIndex(e))}
              onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
            />
          </svg>
        )}
        {!hasData && width > 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-[14px] text-muted" style={{ paddingLeft: PAD.left }}>
            No data in this range yet
          </div>
        )}
        {tip && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[150px] -translate-x-1/2 rounded-lg border border-line bg-panel px-3 py-2 text-[12px] shadow-[var(--shadow)]"
            style={{ left: tipLeft }}
          >
            <div className="mb-1 font-semibold text-ink-2">{tip.label}</div>
            {series.every((s) => tip.values[s.key] == null) ? (
              <div className="text-muted">{emptyLabel}</div>
            ) : (
              <>
                {[...series].reverse().map((s) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <span className="h-[2px] w-3 rounded" style={{ background: s.color }} />
                    <span className="font-bold text-ink tnum">
                      {tip.values[s.key] == null ? "—" : format(tip.values[s.key]!)}
                      {unit}
                    </span>
                    <span className="text-muted">{s.label}</span>
                  </div>
                ))}
                {stacked && series.length > 1 && (
                  <div className="mt-1 border-t border-line pt-1 font-bold tnum">
                    {format(totals[active!] ?? 0)}
                    {unit} total
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <button
        className="mt-2 text-[12px] font-semibold text-ink-2 underline-offset-2 hover:underline"
        aria-expanded={showTable}
        aria-controls={tableId}
        onClick={() => setShowTable((s) => !s)}
      >
        {showTable ? "Hide table" : "Show as table"}
      </button>
      {showTable && (
        <div id={tableId} className="mt-2 max-h-64 overflow-auto rounded-lg border border-line">
          <table className="w-full text-[13px] tnum">
            <thead className="sticky top-0 bg-panel-2 text-left text-ink-2">
              <tr>
                <th className="px-3 py-1.5 font-semibold">Date</th>
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-1.5 text-right font-semibold">
                    {s.label}
                  </th>
                ))}
                {stacked && series.length > 1 && <th className="px-3 py-1.5 text-right font-semibold">Total</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.x} className="border-t border-line">
                  <td className="px-3 py-1.5">{d.label}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right">
                      {d.values[s.key] == null ? "—" : format(d.values[s.key]!)}
                    </td>
                  ))}
                  {stacked && series.length > 1 && <td className="px-3 py-1.5 text-right font-semibold">{totals[i] == null ? "—" : format(totals[i]!)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
