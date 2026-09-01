"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  crearCuenta,
  editarCuenta,
  toggleCuentaActivo,
} from "@/features/contabilidad/actions";
import type { CuentaConSaldo } from "@/features/contabilidad/queries";
import { TIPO_CUENTA, TIPO_CUENTA_LABEL } from "@/features/contabilidad/schema";
import { fmtMoney } from "@/lib/format";

const INICIAL = { codigo: "", nombre: "", rubro: "", tipo: "activo" };

type Formulario = { codigo: string; nombre: string; rubro: string; tipo: string };

export function PlanCuentasManager({
  cuentas,
  admin,
}: {
  cuentas: CuentaConSaldo[];
  admin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Formulario>(INICIAL);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editando, setEditando] = useState<Formulario>(INICIAL);

  function ejecutar(fn: () => Promise<unknown>, okMsj: string) {
    startTransition(async () => {
      const res = (await fn()) as { ok: boolean; error?: string };
      if (!res.ok) toast.error(res.error ?? "Error.");
      else toast.success(okMsj);
      router.refresh();
    });
  }

  function onCrear(e: React.FormEvent) {
    e.preventDefault();
    ejecutar(() => crearCuenta(form), "Cuenta creada.");
    setForm(INICIAL);
  }

  function onEditar(e: React.FormEvent) {
    e.preventDefault();
    if (!editandoId) return;
    ejecutar(() => editarCuenta({ id: editandoId, ...editando }), "Cuenta editada.");
    setEditandoId(null);
  }

  return (
    <div className="space-y-4">
      {admin ? (
        <form
          onSubmit={onCrear}
          className="grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div className="grid gap-1.5">
            <Label className="text-xs">Código</Label>
            <Input
              placeholder="1.1.1"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Nombre</Label>
            <Input
              placeholder="Caja"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Rubro</Label>
            <Input
              placeholder="Activo Corriente"
              value={form.rubro}
              onChange={(e) => setForm({ ...form, rubro: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select
              items={TIPO_CUENTA.map((t) => ({
                label: TIPO_CUENTA_LABEL[t],
                value: t,
              }))}
              value={form.tipo}
              onValueChange={(v) => setForm({ ...form, tipo: v ? String(v) : "activo" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPO_CUENTA.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_CUENTA_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending} className="lg:col-span-1 self-end">
            {pending ? "Guardando…" : "Crear cuenta"}
          </Button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead>Rubro</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estado</TableHead>
              {admin ? <TableHead>Acciones</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cuentas.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={admin ? 6 : 5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Todavía no hay cuentas.
                </TableCell>
              </TableRow>
            ) : (
              cuentas.map((c) =>
                editandoId === c.id ? (
                  <TableRow key={c.id}>
                    <TableCell colSpan={admin ? 6 : 5}>
                      <form
                        onSubmit={onEditar}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <Input
                          className="w-20"
                          placeholder="1.1.1"
                          value={editando.codigo}
                          onChange={(e) =>
                            setEditando({ ...editando, codigo: e.target.value })
                          }
                          required
                        />
                        <Input
                          className="w-40"
                          value={editando.nombre}
                          onChange={(e) =>
                            setEditando({ ...editando, nombre: e.target.value })
                          }
                          required
                        />
                        <Input
                          className="w-40"
                          value={editando.rubro}
                          onChange={(e) =>
                            setEditando({ ...editando, rubro: e.target.value })
                          }
                          required
                        />
                        <Select
                          items={TIPO_CUENTA.map((t) => ({
                            label: TIPO_CUENTA_LABEL[t],
                            value: t,
                          }))}
                          value={editando.tipo}
                          onValueChange={(v) =>
                            setEditando({ ...editando, tipo: v ? String(v) : "activo" })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPO_CUENTA.map((t) => (
                              <SelectItem key={t} value={t}>
                                {TIPO_CUENTA_LABEL[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="submit" size="sm" disabled={pending}>
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditandoId(null)}
                        >
                          Cancelar
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <span className="font-mono text-xs text-muted-foreground">
                        {c.codigo}
                      </span>{" "}
                      {c.nombre}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.rubro}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{TIPO_CUENTA_LABEL[c.tipo]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.saldo !== 0 ? fmtMoney(c.saldo) : "—"}
                    </TableCell>
                    <TableCell>
                      {c.activo ? (
                        <Badge variant="secondary">Activa</Badge>
                      ) : (
                        <Badge variant="outline">Inactiva</Badge>
                      )}
                    </TableCell>
                    {admin ? (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => {
                              setEditando({
                                codigo: c.codigo,
                                nombre: c.nombre,
                                rubro: c.rubro,
                                tipo: c.tipo,
                              });
                              setEditandoId(c.id);
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              ejecutar(() => toggleCuentaActivo(c.id), c.activo ? "Cuenta desactivada." : "Cuenta activada.")
                            }
                          >
                            {c.activo ? "Desactivar" : "Activar"}
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ),
              )
            )}
          </TableBody>
        </Table>
      </div>

      {admin ? (
        <p className="text-xs text-muted-foreground">
          Las cuentas inactivas se ocultan del balance. El código debe ser
          jerárquico (ej. 3.2.1) y único.
        </p>
      ) : null}
    </div>
  );
}