/** The PrépaMarathon wordmark, as on prepamarathon.com, with the Via Sana mention. */
export function Wordmark({ sub = "par Via Sana", size = "md" }: { sub?: string | null; size?: "md" | "lg" }) {
  return (
    <span className="inline-flex flex-col leading-none">
      <span className={`font-display font-bold tracking-[0.04em] uppercase ${size === "lg" ? "text-2xl" : "text-lg"}`}>
        Prépa<span className="text-accent">marathon</span>
      </span>
      {sub && <span className="mt-1 text-[11px] text-muted">{sub}</span>}
    </span>
  );
}
