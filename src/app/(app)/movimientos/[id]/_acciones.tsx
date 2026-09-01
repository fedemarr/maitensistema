"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { eliminarMovimiento } from "@/features/movimientos/actions";

export function MovimientoAcciones({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  function onEliminar() {
    startTransition(async () => {
      const res = await eliminarMovimiento(id);
      if (!res.ok) {
        toast.error(res.error);
        setConfirmando(false);
      } else {
        toast.success("Movimiento eliminado y stock revertido.");
        router.push("/movimientos");
        router.refresh();
      }
    });
  }

  if (confirmando) {
    return (
      <div className="flex gap-2">
        <Button variant="destructive" onClick={onEliminar} disabled={pending}>
          Confirmar borrado
        </Button>
        <Button
          variant="ghost"
          onClick={() => setConfirmando(false)}
          disabled={pending}
        >
          No
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      className="text-destructive"
      onClick={() => setConfirmando(true)}
      disabled={pending}
    >
      Eliminar
    </Button>
  );
}
