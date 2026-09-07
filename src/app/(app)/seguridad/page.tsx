import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  filtrosAuditoria,
  listAuditoria,
  resumenSeguridad,
  type FiltroAuditoria,
} from "@/features/auditoria/queries";
import {
  ACCIONES,
  ACCION_LABEL,
  ACCIONES_SENSIBLES,
  entidadLabel,
  type Accion,
} from "@/features/auditoria/schema";
import { requireUser } from "@/lib/auth";
import { fmtNumber } from "@/lib/format";

export const metadata = { title: "Seguridad — Maitén" };

function fmtFechaHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const selectCls =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm";

export default async function SeguridadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (user.rol !== "admin") redirect("/");

  const sp = await searchParams;
  const filtro: FiltroAuditoria = {
    usuarioId: sp.usuario || undefined,
    entidad: sp.entidad || undefined,
    accion: (sp.accion as Accion) || undefined,
    desde: sp.desde || undefined,
    hasta: sp.hasta || undefined,
    pagina: sp.pagina ? Number(sp.pagina) : 1,
  };

  const [{ eventos, total, pagina, paginas }, filtros, resumen] =
    await Promise.all([
      listAuditoria(filtro),
      filtrosAuditoria(),
      resumenSeguridad(),
    ]);

  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const base = { ...sp, ...patch };
    for (const [k, v] of Object.entries(base)) {
      if (v != null && v !== "") p.set(k, String(v));
    }
    return `?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Seguridad</h1>
        <p className="text-sm text-muted-foreground">
          Registro de auditoría: quién hizo qué y cuándo. Cada alta,
          modificación, baja, ingreso y acceso denegado queda asentado.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: "Eventos hoy", v: fmtNumber(resumen.hoy) },
          { k: "Últimos 7 días", v: fmtNumber(resumen.semana) },
          {
            k: "Accesos denegados (7d)",
            v: fmtNumber(resumen.accesosDenegados7d),
            alerta: resumen.accesosDenegados7d > 0,
          },
          {
            k: "Último ingreso",
            v: resumen.ultimoLogin
              ? resumen.ultimoLogin.actor
              : "—",
            d: resumen.ultimoLogin
              ? fmtFechaHora(resumen.ultimoLogin.fecha)
              : undefined,
          },
        ].map((t) => (
          <Card key={t.k} className="gap-1">
            <CardHeader className="pb-0">
              <CardTitle className="text-[11px] uppercase text-muted-foreground">
                {t.k}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-xl font-bold tabular-nums ${
                  t.alerta ? "text-destructive" : ""
                }`}
              >
                {t.v}
              </p>
              {t.d ? (
                <p className="text-xs text-muted-foreground">{t.d}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {resumen.porUsuario.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Actividad por usuario (últimos 7 días)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {resumen.porUsuario.map((u) => (
              <span
                key={u.nombre}
                className="rounded-md border bg-muted/40 px-2.5 py-1 text-sm"
              >
                {u.nombre}{" "}
                <b className="tabular-nums">{fmtNumber(u.n)}</b>
              </span>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            method="get"
            className="flex flex-wrap items-end gap-2 text-sm"
          >
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Usuario</span>
              <select name="usuario" defaultValue={sp.usuario ?? ""} className={selectCls}>
                <option value="">Todos</option>
                {filtros.usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Módulo</span>
              <select name="entidad" defaultValue={sp.entidad ?? ""} className={selectCls}>
                <option value="">Todos</option>
                {filtros.entidades.map((e) => (
                  <option key={e} value={e}>
                    {entidadLabel(e)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Acción</span>
              <select name="accion" defaultValue={sp.accion ?? ""} className={selectCls}>
                <option value="">Todas</option>
                {ACCIONES.map((a) => (
                  <option key={a} value={a}>
                    {ACCION_LABEL[a]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Desde</span>
              <input
                type="date"
                name="desde"
                defaultValue={sp.desde ?? ""}
                className={selectCls}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Hasta</span>
              <input
                type="date"
                name="hasta"
                defaultValue={sp.hasta ?? ""}
                className={selectCls}
              />
            </label>
            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              Filtrar
            </button>
            {Object.keys(sp).length > 0 ? (
              <Link
                href="/seguridad"
                className="h-9 rounded-md border px-3 text-sm leading-9"
              >
                Limpiar
              </Link>
            ) : null}
          </form>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Sin eventos para el filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  eventos.map((e) => {
                    const sensible = ACCIONES_SENSIBLES.includes(
                      e.accion as Accion,
                    );
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                          {fmtFechaHora(e.fecha)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {e.actor ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={sensible ? "destructive" : "secondary"}
                          >
                            {ACCION_LABEL[e.accion as Accion] ?? e.accion}
                          </Badge>
                        </TableCell>
                        <TableCell>{entidadLabel(e.entidad)}</TableCell>
                        <TableCell className="max-w-md">
                          {e.datos != null ? (
                            <details>
                              <summary className="cursor-pointer text-xs text-muted-foreground">
                                ver datos
                              </summary>
                              <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-[11px]">
                                {JSON.stringify(e.datos, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {fmtNumber(total)} evento{total === 1 ? "" : "s"} · página {pagina}{" "}
              de {paginas}
            </span>
            <div className="flex gap-2">
              {pagina > 1 ? (
                <Link
                  href={qs({ pagina: pagina - 1 })}
                  className="rounded-md border px-2.5 py-1"
                >
                  ← Anterior
                </Link>
              ) : null}
              {pagina < paginas ? (
                <Link
                  href={qs({ pagina: pagina + 1 })}
                  className="rounded-md border px-2.5 py-1"
                >
                  Siguiente →
                </Link>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
