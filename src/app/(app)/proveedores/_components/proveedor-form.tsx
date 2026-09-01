"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { guardarProveedor } from "@/features/proveedores/actions";
import type { Proveedor } from "@/features/proveedores/queries";

export function ProveedorForm({
  proveedor,
}: {
  proveedor?: Proveedor;
}) {
  const router = useRouter();
  const editing = Boolean(proveedor);

  const [nombre, setNombre] = useState(proveedor?.nombre ?? "");
  const [cuit, setCuit] = useState(proveedor?.cuit ?? "");
  const [email, setEmail] = useState(proveedor?.email ?? "");
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? "");
  const [notas, setNotas] = useState(proveedor?.notas ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      nombre,
      cuit: cuit || "",
      email: email || "",
      telefono: telefono || "",
      notas: notas || "",
    };

    const res = await guardarProveedor(payload, proveedor?.id);
    setSaving(false);

    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Proveedor actualizado." : "Proveedor creado.");
    router.push(`/proveedores/${res.id}`);
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
            placeholder="Nombre del proveedor"
            required
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
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="proveedor@email.com"
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
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas sobre el proveedor..."
          rows={3}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving
            ? "Guardando…"
            : editing
              ? "Guardar cambios"
              : "Crear proveedor"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/proveedores")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
