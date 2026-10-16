import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { get } from "@/lib/db";
import type { PractitionerUser } from "@/lib/auth";
import { getReportFor } from "@/lib/queries";
import { ReportDocument } from "@/components/report";
import { PrintButton } from "@/components/print-button";
import { Card } from "@/components/ui";

export default async function ReportPage({ params }: PageProps<"/compte-rendu/[id]">) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/connexion");

  let view;
  let back = "/";
  if (session.type === "patient") {
    view = await getReportFor({ type: "patient", id: session.id }, id);
    back = "/patient";
  } else if (session.type === "practitioner") {
    const user = await get<PractitionerUser>("SELECT * FROM practitioners WHERE id = ?", session.id);
    if (!user) redirect("/connexion");
    view = await getReportFor({ type: "practitioner", user }, id);
    back = view ? `/praticien/patients/${view.patient.id}` : "/praticien";
  } else {
    view = await getReportFor({ type: "coordinator", id: session.id }, id);
    back = "/coordination";
  }

  if (view === null && session.type === "coordinator") {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <h1 className="mb-2 text-lg font-semibold">Compte rendu non accessible</h1>
          <p className="text-sm text-muted">
            La coordination organise le parcours mais n&apos;est pas un professionnel de santé : elle n&apos;a pas accès au contenu
            clinique des comptes rendus. Cette tentative a été enregistrée.
          </p>
          <Link href={back} className="btn btn-secondary mt-4">Retour</Link>
        </Card>
      </main>
    );
  }
  if (!view) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 print:p-0">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href={back} className="text-sm text-muted hover:text-foreground">← Retour</Link>
        <PrintButton />
      </div>
      <ReportDocument {...view} />
    </main>
  );
}
