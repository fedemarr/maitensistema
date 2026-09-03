import { EnConstruccion } from "@/components/en-construccion";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Consignaciones — Maitén" };

export default async function ConsignacionesPage() {
  await requireUser();
  return <EnConstruccion titulo="Consignaciones" />;
}
