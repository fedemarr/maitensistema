import { NextResponse } from "next/server";

import { pdfFactura } from "@/features/afip/lib/pdf";
import { facturaCompleta } from "@/features/afip/queries";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;

  const f = await facturaCompleta(id);
  if (!f) return new NextResponse("Factura no encontrada.", { status: 404 });

  const pdf = await pdfFactura(f);
  const nombre = `Factura_${f.tipoComprobante}_${String(f.puntoVenta).padStart(5, "0")}-${String(
    f.numero,
  ).padStart(8, "0")}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  });
}
