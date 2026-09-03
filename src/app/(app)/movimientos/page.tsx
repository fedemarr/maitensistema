import { EnConstruccion } from "@/components/en-construccion";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Movimientos — Maitén" };

export default async function MovimientosPage() {
  await requireUser();
  return <EnConstruccion titulo="Movimientos" />;
}
