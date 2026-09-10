import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { integraciones } from "@/db/schema";
import { intercambiarCodigo } from "@/features/tiendanube/api";
import { PROVEEDOR } from "@/features/tiendanube/queries";
import { registrarAuditoria } from "@/lib/audit";
import { siteUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

/**
 * Callback del OAuth de Tiendanube. Recibe `?code=...` tras autorizar la app
 * en la tienda, lo cambia por el access_token y guarda la integración.
 */
export async function GET(req: NextRequest) {
  const base = await siteUrl();
  const destino = `${base}/config/integraciones`;
  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(`${destino}?tn=error&detalle=${encodeURIComponent(err)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${destino}?tn=error&detalle=sin_code`);
  }

  try {
    const tok = await intercambiarCodigo(code);
    await db
      .insert(integraciones)
      .values({
        proveedor: PROVEEDOR,
        storeId: String(tok.user_id),
        accessToken: tok.access_token,
        scope: tok.scope,
        estado: "conectado",
      })
      .onConflictDoUpdate({
        target: integraciones.proveedor,
        set: {
          storeId: String(tok.user_id),
          accessToken: tok.access_token,
          scope: tok.scope,
          estado: "conectado",
        },
      });

    await registrarAuditoria({
      actorId: null,
      accion: "crear",
      entidad: "integracion",
      datos: { proveedor: PROVEEDOR, storeId: tok.user_id, scope: tok.scope },
    });

    return NextResponse.redirect(`${destino}?tn=ok`);
  } catch (e) {
    return NextResponse.redirect(
      `${destino}?tn=error&detalle=${encodeURIComponent(
        e instanceof Error ? e.message.slice(0, 200) : "fallo",
      )}`,
    );
  }
}
