import type { CheckinRow } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { EmptyState } from "./ui";

function painTone(pain: number | null) {
  if (pain === null) return "text-muted";
  if (pain >= 5) return "text-danger font-semibold";
  if (pain >= 3) return "text-current font-medium";
  return "text-done";
}

export function CheckinTable({ checkins }: { checkins: CheckinRow[] }) {
  if (checkins.length === 0) return <EmptyState>Aucun suivi hebdomadaire pour l&apos;instant.</EmptyState>;
  const maxKm = Math.max(10, ...checkins.map((c) => c.weekly_km ?? 0));
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted uppercase">
            <th className="px-5 py-2 font-medium">Semaine du</th>
            <th className="px-3 py-2 font-medium">Volume</th>
            <th className="px-3 py-2 font-medium">Douleur</th>
            <th className="px-3 py-2 font-medium">Fatigue</th>
            <th className="px-5 py-2 font-medium">Commentaire</th>
          </tr>
        </thead>
        <tbody>
          {checkins.map((c) => (
            <tr key={c.id} className="border-b border-border last:border-0">
              <td className="px-5 py-2 whitespace-nowrap">{formatDate(c.date, { day: "numeric", month: "short" })}</td>
              <td className="px-3 py-2">
                {c.weekly_km === null ? (
                  <span className="text-muted">—</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 overflow-hidden rounded bg-upcoming-soft">
                      <div className="h-full bg-brand" style={{ width: `${(c.weekly_km / maxKm) * 100}%` }} />
                    </div>
                    <span className="tabular-nums">{c.weekly_km} km</span>
                  </div>
                )}
              </td>
              <td className={`px-3 py-2 tabular-nums ${painTone(c.pain)}`}>{c.pain === null ? "—" : `${c.pain}/10`}</td>
              <td className="px-3 py-2 tabular-nums">{c.fatigue === null ? "—" : `${c.fatigue}/10`}</td>
              <td className="px-5 py-2 text-muted">{c.comment || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
