"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleProductoActivo } from "@/features/productos/actions";

export function ProductoAcciones({
  id,
  activo,
}: {
  id: string;
  activo: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onToggle() {
    start(async () => {
      const res = await toggleProductoActivo(id, !activo);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(activo ? "Producto desactivado." : "Producto activado.");
        router.refresh();
      }
    });
  }

  return (
    <Button variant="outline" onClick={onToggle} disabled={pending}>
      {activo ? "Desactivar" : "Activar"}
    </Button>
  );
}
