import type { Bar } from "@/lib/admin/stats";

// Plain CSS charts: readable, theme-aware, no chart library to ship.

export function Columns({ data, label }: { data: Bar[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure>
      <div className="flex h-36 items-end gap-1.5" role="img" aria-label={label}>
        {data.map((d) => (
          <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end">
            <span className="mb-1 text-center text-[11px] font-medium text-muted opacity-0 group-hover:opacity-100">{d.value}</span>
            <div className="rounded-t-md bg-brand" style={{ height: `${Math.max(2, (100 * d.value) / max)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[10.5px] text-muted">
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 truncate text-center">{i % 2 === 0 ? d.label : ""}</span>
        ))}
      </div>
    </figure>
  );
}

export function Rows({ data, label }: { data: Bar[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2" aria-label={label}>
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,13rem)_1fr_3.5rem] items-center gap-3 text-sm">
          <span className="truncate text-muted">{d.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-pill-solid">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (100 * d.value) / max)}%` }} />
          </span>
          <span className="text-right font-medium tabular-nums">{d.value.toLocaleString("fr-FR")}</span>
        </li>
      ))}
    </ul>
  );
}
