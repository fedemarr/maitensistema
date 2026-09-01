"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { guardarCliente } from "@/features/clientes/actions";
import type { Cliente } from "@/features/clientes/queries";
import { TIPO_LABEL, tipoClienteEnum } from "@/features/clientes/schema";

export function ClienteForm({
  cliente,
}: {
  cliente?: Cliente;
}) {
  const router = useRouter();
  const editing = Boolean(cliente);

  const [nombre, setNombre] = useState(cliente?.nombre ?? "");
  const [tipo, setTipo] = useState(cliente?.tipo ?? "particular");
  const [email, setEmail] = useState(cliente?.email ?? "");
  const [telefono, setTelefono] = useState(cliente?.telefono ?? "");
  const [cuit, setCuit] = useState(cliente?.cuit ?? "");
  const [notas, setNotas] = useState(cliente?.notas ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipoItems = tipoClienteEnum.map((t) => ({
    label: TIPO_LABEL[t],
    value: t,
  }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      nombre,
      tipo: tipo as (typeof tipoClienteEnum)[number],
      email: email || "",
      telefono: telefono || "",
      cuit: cuit || "",
      notas: notas || "",
    };

    const res = await guardarCliente(payload, cliente?.id);
    setSaving(false);

    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Cliente actualizado." : "Cliente creado.");
    router.push(`/clientes/${res.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="nombre">Nombre *</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del cliente"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tipo">Tipo *</Label>
          <Select
            items={tipoItems}
            value={tipo}
            onValueChange={(v) => setTipo(v || "particular")}
          >
            <SelectTrigger id="tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tipoItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="11-1234-5678"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cuit">CUIT</Label>
          <Input
            id="cuit"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="20-12345678-9"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas sobre el cliente..."
          rows={3}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear cliente"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/clientes")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
