import { NextResponse, type NextRequest } from "next/server";

import { procesarPedido, verificarFirma } from "@/features/tiendanube/webhook";

export const dynamic = "force-dynamic";

/**
 * Webhook de Tiendanube (order/created, order/paid). Verifica la firma HMAC,
 * y carga el pedido como venta. Responde 200 siempre que la firma sea válida
 * (Tiendanube reintenta ante no-2xx; la idempotencia la maneja procesarPedido).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const firma = req.headers.get("x-linkedstore-hmac-sha256");

  if (!verificarFirma(raw, firma)) {
    return new NextResponse("firma inválida", { status: 401 });
  }

  let payload: { event?: string; id?: number };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("body inválido", { status: 400 });
  }

  if (!payload.id || !payload.event?.startsWith("order/")) {
    return NextResponse.json({ ok: true, ignored: payload.event ?? null });
  }

  try {
    const r = await procesarPedido(payload.id);
    if (!r.ok) {
      // Error real (integración caída, etc.): 500 para que Tiendanube reintente.
      console.error("webhook tiendanube:", r.error);
      return new NextResponse(r.error, { status: 500 });
    }
    return NextResponse.json({ ok: true, estado: r.estado });
  } catch (e) {
    console.error("webhook tiendanube:", e);
    return new NextResponse("error", { status: 500 });
  }
}
