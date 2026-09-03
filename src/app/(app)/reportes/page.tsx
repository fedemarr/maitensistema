import { EnConstruccion } from "@/components/en-construccion";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Reportes — Maitén" };

export default async function ReportesPage() {
  await requireUser();
  return <EnConstruccion titulo="Reportes" />;
}
