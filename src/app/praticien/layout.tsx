import { AppHeader } from "@/components/app-header";
import { requirePractitioner } from "@/lib/auth";
import { PROFESSION_LABEL } from "@/lib/domain";
import { fullName } from "@/lib/format";

export default async function PractitionerLayout({ children }: LayoutProps<"/praticien">) {
  const me = await requirePractitioner();
  return (
    <>
      <AppHeader
        home="/praticien"
        space="Espace praticien"
        userName={fullName(me)}
        userDetail={PROFESSION_LABEL[me.profession]}
        nav={[{ href: "/praticien", label: "Mes patients" }]}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
