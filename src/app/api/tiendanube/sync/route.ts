import { NextResponse, type NextRequest } from "next/server";

import { sincronizarStock } from "@/features/tiendanube/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sincroniza el stock hacia Tiendanube. Lo llama el Vercel Cron (manda
 * `Authorization: Bearer ${CRON_SECRET}`). Protegido por ese secreto.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("no autorizado", { status: 401 });
  }

  try {
    const r = await sincronizarStock();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("sync tiendanube:", e);
    return new NextResponse(
      e instanceof Error ? e.message : "error",
      { status: 500 },
    );
  }
}
