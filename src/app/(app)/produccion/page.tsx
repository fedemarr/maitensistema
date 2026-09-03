import { EnConstruccion } from "@/components/en-construccion";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Produccion — Maitén" };

export default async function ProduccionPage() {
  await requireUser();
  return <EnConstruccion titulo="Produccion" />;
}
