import { AppHeader } from "@/components/app-header";
import { requireCoordinator } from "@/lib/auth";

export default async function CoordinationLayout({ children }: LayoutProps<"/coordination">) {
  const me = await requireCoordinator();
  return (
    <>
      <AppHeader
        home="/coordination"
        space="Coordination"
        userName={`${me.first_name} ${me.last_name}`}
        userDetail="Coordinatrice Via Sana"
        nav={[{ href: "/coordination", label: "Parcours" }]}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
