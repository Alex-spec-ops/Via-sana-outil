import { AppHeader } from "@/components/app-header";
import { requirePatient } from "@/lib/auth";

export default async function PatientLayout({ children }: LayoutProps<"/patient">) {
  const me = await requirePatient();
  return (
    <>
      <AppHeader
        home="/patient"
        space="Mon espace patient"
        userName={`${me.first_name} ${me.last_name}`}
        userDetail="Patient"
        nav={[
          { href: "/patient", label: "Mon parcours" },
          { href: "/patient/formulaire", label: "Mon formulaire" },
          { href: "/patient/confidentialite", label: "Mes données" },
        ]}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
