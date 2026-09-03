import { EnConstruccion } from "@/components/en-construccion";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Insumos — Maitén" };

export default async function InsumosPage() {
  await requireUser();
  return <EnConstruccion titulo="Insumos" />;
}
