import Link from "next/link";
import { Card } from "./ui";

export type QueueItem = { key: string; href: string; who: string; detail?: string; tasks: { label: string; tone: "danger" | "ongoing" }[] };

const TONE = { danger: "bg-danger-soft text-danger", ongoing: "bg-ongoing-soft text-ongoing" } as const;

/** "À traiter": the patients who need something from this professional, most urgent first. */
export function WorkQueue({ items, emptyText }: { items: QueueItem[]; emptyText: string }) {
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          À traiter
          {items.length > 0 && <span className="rounded-full bg-ongoing px-2 py-0.5 text-xs text-white tabular-nums">{items.length}</span>}
        </span>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted">✓ {emptyText}</p>
      ) : (
        <ul className="-mx-5 divide-y divide-border border-t border-border">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2.5 transition hover:bg-background">
                <span className="min-w-40">
                  <span className="block text-sm font-medium text-brand">{item.who}</span>
                  {item.detail && <span className="block text-xs text-muted">{item.detail}</span>}
                </span>
                <span className="flex flex-1 flex-wrap gap-1">
                  {item.tasks.map((t) => (
                    <span key={t.label} className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE[t.tone]}`}>{t.label}</span>
                  ))}
                </span>
                <span className="text-sm text-muted" aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
