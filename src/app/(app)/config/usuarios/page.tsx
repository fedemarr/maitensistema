import { redirect } from "next/navigation";

import { listUsuarios } from "@/features/usuarios/queries";
import { requireUser } from "@/lib/auth";

import { UsuariosPanel } from "./_components/usuarios-panel";

export const metadata = { title: "Usuarios — Maitén" };

export default async function UsuariosPage() {
  const user = await requireUser();
  if (user.rol !== "admin") redirect("/");

  const usuarios = await listUsuarios();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Invitá gente al sistema y definí qué puede hacer cada una.
        </p>
      </div>
      <UsuariosPanel usuarios={usuarios} miId={user.id} />
    </div>
  );
}
