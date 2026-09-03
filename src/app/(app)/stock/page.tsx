import { EnConstruccion } from "@/components/en-construccion";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Stock — Maitén" };

export default async function StockPage() {
  await requireUser();
  return <EnConstruccion titulo="Stock" />;
}
