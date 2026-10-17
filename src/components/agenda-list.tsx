import Link from "next/link";
import { formatDate, formatTime } from "@/lib/format";
import { EmptyState } from "./ui";

export type AgendaItem = { id: string; starts_at: string; duration_min: number; href: string; who: string; what: string };

const parisDay = (d: Date) => d.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" }); // YYYY-MM-DD

function dayLabel(day: string) {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (day === parisDay(today)) return "Aujourd'hui";
  if (day === parisDay(tomorrow)) return "Demain";
  return formatDate(`${day}T12:00:00`, { weekday: "long", day: "numeric", month: "long" });
}

/** Upcoming sessions grouped by day, today and tomorrow named as such. */
export function AgendaList({ items, empty = "Aucune séance planifiée." }: { items: AgendaItem[]; empty?: string }) {
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>;
  const days = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const day = parisDay(new Date(item.starts_at));
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  return (
    <div className="space-y-4">
      {[...days].map(([day, list]) => {
        const label = dayLabel(day);
        const soon = label === "Aujourd'hui";
        return (
          <section key={day}>
            <h3 className={`mb-1.5 text-xs font-semibold tracking-wide uppercase first-letter:uppercase ${soon ? "text-brand" : "text-muted"}`}>{label}</h3>
            <ul className="space-y-1">
              {list.map((s) => (
                <li key={s.id}>
                  <Link href={s.href} className="-mx-2 flex gap-3 rounded-md px-2 py-1.5 transition hover:bg-background">
                    <span className="w-11 shrink-0 pt-px text-sm font-semibold tabular-nums">{formatTime(s.starts_at)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-brand">{s.who}</span>
                      <span className="block truncate text-xs text-muted">{s.what} · {s.duration_min} min</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
