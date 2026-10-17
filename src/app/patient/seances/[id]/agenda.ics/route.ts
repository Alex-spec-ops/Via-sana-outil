import { requirePatient } from "@/lib/auth";
import { get } from "@/lib/db";

// One appointment as an iCalendar file, so the patient can add it to their own
// calendar. Only logistics go in it (title, practitioner, place, time): nothing
// clinical leaves the application this way.

type Row = { id: string; starts_at: string; duration_min: number; location: string; practitioner_name: string; step_title: string | null };

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");

export async function GET(_req: Request, { params }: RouteContext<"/patient/seances/[id]/agenda.ics">) {
  const me = await requirePatient();
  const { id } = await params;
  const session = await get<Row>(
    `SELECT s.id, s.starts_at, s.duration_min, s.location, es.title AS step_title,
            TRIM(pr.title || ' ' || pr.first_name || ' ' || pr.last_name) AS practitioner_name
       FROM sessions s
       JOIN enrollments e ON e.id = s.enrollment_id
       JOIN practitioners pr ON pr.id = s.practitioner_id
       LEFT JOIN enrollment_steps es ON es.id = s.enrollment_step_id
      WHERE s.id = ? AND e.patient_id = ? AND s.status = 'prevue'`,
    id, me.id,
  );
  if (!session) return new Response("Séance introuvable", { status: 404 });

  const start = new Date(session.starts_at);
  const end = new Date(start.getTime() + session.duration_min * 60_000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Via Sana//PrepaMarathon//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${session.id}@viasana.example`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`${session.step_title ?? "Séance"} · ${session.practitioner_name}`)}`,
    `LOCATION:${escape(session.location)}`,
    "DESCRIPTION:Rendez-vous organisé par Via Sana (PrépaMarathon).",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Rappel de séance",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="seance-via-sana.ics"',
      "Cache-Control": "no-store",
    },
  });
}
