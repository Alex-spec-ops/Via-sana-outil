import { getSharedReport } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { ReportDocument } from "@/components/report";
import { PrintButton } from "@/components/print-button";
import { Card, Notice } from "@/components/ui";

// A practitioner outside the care team (e.g. the patient's usual physio) opens
// the report the patient chose to share with them. The link stops working as
// soon as the patient revokes it, and every opening is in the patient's journal.
export default async function SharedReportPage({ params }: PageProps<"/partage/[token]">) {
  const { token } = await params;
  const view = getSharedReport(token);

  if (!view) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <h1 className="mb-2 text-lg font-semibold">Lien inactif</h1>
          <p className="text-sm text-muted">Ce partage n&apos;existe pas ou a été révoqué par le patient.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-6 print:p-0">
      <div className="print:hidden">
        <Notice>
          Partagé par {view.patient.first_name} {view.patient.last_name} avec <strong>{view.share.recipient_name}</strong> (
          {view.share.recipient_role.toLowerCase()}) le {formatDate(view.share.consent_at)}, avec son consentement. Ce lien peut être
          révoqué à tout moment ; chaque ouverture est visible par le patient.
        </Notice>
      </div>
      <div className="flex justify-end print:hidden">
        <PrintButton />
      </div>
      <ReportDocument report={view.report} patient={view.patient} enrollment={view.enrollment} />
    </main>
  );
}
